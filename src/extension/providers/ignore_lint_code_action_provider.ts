import { CancellationToken, CodeAction, CodeActionContext, CodeActionKind, CodeActionProviderMetadata, DocumentSelector, Range, TextDocument, WorkspaceEdit } from "vscode";
import { config } from "../config";
import { isAnalyzableAndInWorkspace } from "../utils";
import { DartDiagnostic } from "./dart_diagnostic_provider";
import { RankedCodeActionProvider } from "./ranking_code_action_provider";

export class IgnoreLintCodeActionProvider implements RankedCodeActionProvider {
	constructor(public readonly selector: DocumentSelector) { }

	public readonly rank = 100;

	public readonly metadata: CodeActionProviderMetadata = {
		providedCodeActionKinds: [CodeActionKind.QuickFix],
	};

	public provideCodeActions(document: TextDocument, range: Range, context: CodeActionContext, token: CancellationToken): CodeAction[] | undefined {
		if (!isAnalyzableAndInWorkspace(document))
			return;
		// If we were only asked for specific action types and that doesn't include
		// quickfix (which is all we supply), bail out.
		if (context && context.only && !context.only.contains(CodeActionKind.QuickFix))
			return;

		if (!config.showIgnoreQuickFixes || !context || !context.diagnostics || !context.diagnostics.length)
			return;

		const lintErrors = context.diagnostics.filter((d) => d instanceof DartDiagnostic && (d.type === "LINT" || d.type === "HINT"));
		if (!lintErrors.length)
			return;

		return lintErrors.map((diagnostic) => this.convertResult(document, diagnostic as DartDiagnostic));
	}

	private convertResult(document: TextDocument, diagnostic: DartDiagnostic): CodeAction {
		const edit = new WorkspaceEdit();
		const line = document.lineAt(diagnostic.range.start.line);
		edit.insert(
			document.uri,
			line.range.start,
			`${" ".repeat(line.firstNonWhitespaceCharacterIndex)}// ignore: ${diagnostic.code}\n`,
		);

		const title = `Ignore ${diagnostic.type.toLowerCase()} '${diagnostic.code}' for this line`;
		const action = new CodeAction(title, CodeActionKind.QuickFix);
		action.edit = edit;
		return action;
	}
}
