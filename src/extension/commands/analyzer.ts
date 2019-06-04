import * as vs from "vscode";
import { Analyzer } from "../analysis/analyzer";
import { DiagnosticServerRequest } from "../lsp/custom_protocol";
import { lspClient } from "../lsp/setup";
import { openInBrowser } from "../utils";

export class AnalyzerCommands {
	constructor(context: vs.ExtensionContext, analyzer: Analyzer) {
		context.subscriptions.push(vs.commands.registerCommand("dart.openAnalyzerDiagnostics", async () => {
			const res = await analyzer.diagnosticGetServerPort();
			openInBrowser(`http://localhost:${res.port}/`);

			if (lspClient) {
				const diagServer = await lspClient.sendRequest(DiagnosticServerRequest.type, undefined);
				openInBrowser(`http://localhost:${diagServer.port}`);
			}
		}));
	}
}
