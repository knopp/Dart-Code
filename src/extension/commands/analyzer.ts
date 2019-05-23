import * as vs from "vscode";
import { Analyzer } from "../analysis/analyzer";
import { lspClient } from "../lsp/setup";
import { openInBrowser } from "../utils";

export class AnalyzerCommands {
	constructor(context: vs.ExtensionContext, analyzer: Analyzer) {
		context.subscriptions.push(vs.commands.registerCommand("dart.openAnalyzerDiagnostics", async () => {
			const res = await analyzer.diagnosticGetServerPort();
			openInBrowser(`http://localhost:${res.port}/`);

			if (lspClient) {
				const diagServer = await lspClient.sendRequest<{ port: number }>("dart/diagnosticServer");
				openInBrowser(`http://localhost:${diagServer.port}`);
			}
		}));
	}
}
