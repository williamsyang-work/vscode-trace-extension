import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import Ajv from 'ajv/dist/2020';
import { reject } from 'lodash';

// Note: API functions (fetchSchema, fetchConfig, saveConfig) are implemented 
// in another class and should be imported from there

interface JSONSchemaDefinition {
    $schema?: string;
    type?: string;
    properties?: Record<string, JSONSchemaDefinition>;
    items?: JSONSchemaDefinition;
    default?: any;
    enum?: any[];
    description?: string;
    minimum?: number;
    maximum?: number;
    required?: string[];
}

type DefaultValue = string | number | boolean | null | Record<string, any> | any[];

export class JsonConfigEditor {
    private readonly ajv: Ajv;
    private tempFilePath: string;
    private isEditing: boolean = false;
    private trackedEditor?: vscode.TextEditor;
    private closeSubscription?: vscode.Disposable;

    constructor() {
        this.ajv = new Ajv();
        this.tempFilePath = path.join(os.tmpdir(), `vscode-config-${Date.now()}.json`); // TODO is this needed
    }

    /**
     * Validates a JSON file against a schema
     * @param filePath Path to the JSON file
     * @param schema JSON schema to validate against
     * @returns Object with validation results
     */
    public validateJsonFile(filePath: string, schema: any): { isValid: boolean; content?: any; errors?: string[] } {
        try {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const jsonContent = JSON.parse(fileContent);
            
            // Create a new validator for this schema to avoid ID conflicts
            const validator = this.getValidator(schema);
            if (validator(jsonContent)) {
                return { isValid: true, content: jsonContent };
            } else {
                const errors = validator.errors?.map(error => 
                    `${error.instancePath} ${error.message}`
                ) || [];
                return { isValid: false, errors };
            }
        } catch (error) {
            if (error instanceof Error) {
                return { isValid: false, errors: [error.message] };
            }
            return { isValid: false, errors: ['Unknown error occurred while validating JSON file'] };
        }
    }

    /**
     * Opens a JSON editor with the provided schema and configuration
     * @param schema JSON schema to use for validation
     * @param config Initial configuration to edit
     * @returns Promise resolving to the edited and validated JSON, or undefined if canceled
     */
    public async openJsonEditor(
        schema: any,
        options: { sourceFile?: vscode.Uri } = {}
    ): Promise<Object | undefined> {
        if (this.isEditing) {
            vscode.window.showInformationMessage('A config editing session is already active');
            return undefined;
        }

        try {
            this.isEditing = true;
            this.tempFilePath = path.join(os.tmpdir(), schema.$id);

            const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
            statusBarItem.text = "$(loading~spin) Loading configuration...";
            statusBarItem.show();

            const config = this.extractSchemaDefaults(schema);
            try {
                // Write config to temp file
                fs.writeFileSync(
                    this.tempFilePath, 
                    JSON.stringify(config, null, 2),
                    'utf-8'
                );

                const uri = vscode.Uri.file(this.tempFilePath);
                const document = await vscode.workspace.openTextDocument(uri);
                this.trackedEditor = await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.Beside });

                await this.setJsonSchema(uri, schema);
                // Return a promise that resolves when the editor is closed
                return new Promise<Object>((resolve) => {
                    this.closeSubscription = vscode.window.onDidChangeVisibleTextEditors(async (editors) => {
                        if (this.trackedEditor && !editors.some(e => e.document.uri.fsPath === this.tempFilePath)) {
                            if (this.closeSubscription) {
                                this.closeSubscription.dispose();
                            }
                            
                            const result = await this.handleDocumentClose(this.trackedEditor.document, schema);
                            this.trackedEditor = undefined;
                            this.isEditing = false;
                            if (result) { 
                                resolve(result);
                            } else {
                                reject("Error onclose... TODO Make this better");
                            }
                        }
                    });
                });
            } finally {
                statusBarItem.dispose();
            }
        } catch (error) {
            this.isEditing = false;
            if (error instanceof Error) {
                vscode.window.showErrorMessage(error.message);
            }
            return undefined;
        }
    }

    /**
     * Handles document close event and validates the content
     * @param document VS Code text document
     * @param schema Schema to validate against
     * @returns The validated JSON or undefined if invalid or canceled
     */
    private async handleDocumentClose(document: vscode.TextDocument, schema: any): Promise<any | undefined> {
        try {
            const content = document.getText();
            let jsonContent: any;

            try {
                jsonContent = JSON.parse(content);
            } catch (error) {
                vscode.window.showErrorMessage('Invalid JSON format. Please fix the JSON syntax before closing.');
                return undefined;
            }

            // Validate against schema
            const validator = this.getValidator(schema);

            if (validator(jsonContent)) {

                const submit = await vscode.window.showInformationMessage(
                    'Do you want to submit this configuration?',
                    'Yes',
                    'No'
                );

                
                const saveAs = await vscode.window.showInformationMessage(
                    'Do you want to store this configuration for future use?',
                    'Yes',
                    'No'
                );
                
                if (saveAs === 'Yes') {
                    const uri = await vscode.window.showSaveDialog({
                        filters: {
                            'JSON files': ['json']
                        },
                        title: 'Save Configuration File',
                        saveLabel: 'Save Configuration',
                        defaultUri: vscode.Uri.file('config.json')
                    });
                    
                    if (uri) {
                        try {
                            const jsonString = JSON.stringify(jsonContent, null, 2);
                            
                            await vscode.workspace.fs.writeFile(
                                uri,
                                Buffer.from(jsonString, 'utf8')
                            );
                            
                            vscode.window.showInformationMessage('Configuration file saved successfully');
                        } catch (error) {
                            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
                            vscode.window.showErrorMessage(`Failed to save configuration file: ${errorMessage}`);
                        }
                    }

                }
                
                if (submit === 'Yes') {
                    return jsonContent;
                }
                
                return undefined; // User chose not to submit
            } else {
                const errors = validator.errors?.map(error => 
                    `${error.instancePath} ${error.message}`
                ).join('\n');
                
                const viewDetails = 'View Details';
                const response = await vscode.window.showErrorMessage(
                    'Configuration has validation errors. \n Changes were not saved.',
                    viewDetails
                );

                if (response === viewDetails) {
                    // Show errors in new document
                    const errorDoc = await vscode.workspace.openTextDocument({
                        content: `Validation Errors:\n\n${errors}`,
                        language: 'text'
                    });
                    await vscode.window.showTextDocument(errorDoc, { viewColumn: vscode.ViewColumn.Beside });
                }
                
                return undefined; // Invalid JSON
            }
        } catch (error) {
            if (error instanceof Error) {
                vscode.window.showErrorMessage(error.message);
            }
            return undefined;
        } finally {
            // Clean up
            if (fs.existsSync(this.tempFilePath)) {
                fs.unlinkSync(this.tempFilePath);
            }
            this.isEditing = false;
            if (this.closeSubscription) {
                this.closeSubscription.dispose();
            }
        }
    }

    /**
     * Get a validator for a schema, handling ID conflicts
     * @param schema Schema to validate against
     * @returns Compiled validation function
     */
    private getValidator(schema: any): ReturnType<typeof this.ajv.compile> {
        // Handle schema ID conflicts by creating a new validator or removing existing schema
        if (schema.$id) {
            if (this.ajv.getSchema(schema.$id)) {
                this.ajv.removeSchema(schema.$id);
            }
        }
        
        return this.ajv.compile(schema);
    }

    /**
     * Sets the JSON schema for a document
     * @param documentUri Document URI
     * @param schema Schema to set
     */
    private async setJsonSchema(documentUri: vscode.Uri, schema: any): Promise<void> {
        const config = vscode.workspace.getConfiguration('json');
        const schemas = config.get('schemas') as any[] || [];

        // Add or update schema for this document
        const schemaConfig = {
            fileMatch: [documentUri.toString()],
            schema: schema
        };

        const existingIndex = schemas.findIndex(s => 
            s.fileMatch.includes(documentUri.toString())
        );

        if (existingIndex >= 0) {
            schemas[existingIndex] = schemaConfig;
        } else {
            schemas.push(schemaConfig);
        }

        await config.update('schemas', schemas, vscode.ConfigurationTarget.Global);
    }

    private extractSchemaDefaults = (
        schema: JSONSchemaDefinition,
        undefinedValue: DefaultValue = null
    ): DefaultValue => {
        if (!schema || typeof schema !== 'object') {
            return undefinedValue;
        }
    
        if (schema.type === 'array' && schema.items) {
            return Array.isArray(schema.default) ? schema.default : [];
        }
    
        if (schema.type && schema.type !== 'object') {
            return schema.default !== undefined ? schema.default : undefinedValue;
        }
    
        if (schema.properties) {
            const defaults: Record<string, DefaultValue> = {};
            
            for (const [key, value] of Object.entries(schema.properties)) {
                // Recursively process nested objects
                defaults[key] = this.extractSchemaDefaults(value, undefinedValue);
            }
            
            // If the schema itself has a default, use it instead
            return schema.default !== undefined ? schema.default : defaults;
        }
    
        return schema.default !== undefined ? schema.default : undefinedValue;
    }

}