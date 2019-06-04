import * as vs from "vscode";
import { LanguageClient } from "vscode-languageclient";
import { fsPath } from "../../shared/vscode/utils";
import { ClosingLabelsParams, PublishClosingLabelsNotification } from "./custom_protocol";

export class LspClosingLabelsDecorations implements vs.Disposable {
	private subscriptions: vs.Disposable[] = [];
	private closingLabels?: { [key: string]: ClosingLabelsParams } = {};
	private updateTimeout?: NodeJS.Timer;

	private readonly decorationType = vs.window.createTextEditorDecorationType({
		after: {
			color: new vs.ThemeColor("dart.closingLabels"),
			margin: "2px",
		},
		rangeBehavior: vs.DecorationRangeBehavior.ClosedOpen,
	});

	constructor(private readonly analyzer: LanguageClient) {
		analyzer.onReady().then(() => {
			this.analyzer.onNotification(PublishClosingLabelsNotification.type, (n) => {
				const filePath = fsPath(vs.Uri.parse(n.uri));
				this.closingLabels[filePath] = n;
				// Fire an update if it was for the active document.
				if (vs.window.activeTextEditor
					&& vs.window.activeTextEditor.document
					&& filePath === fsPath(vs.window.activeTextEditor.document.uri)) {
					// Delay this so if we're getting lots of updates we don't flicker.
					if (this.updateTimeout)
						clearTimeout(this.updateTimeout);
					this.updateTimeout = setTimeout(() => this.update(), 500);
				}
			});
		});

		this.subscriptions.push(vs.window.onDidChangeActiveTextEditor((_) => this.update()));
		this.subscriptions.push(vs.workspace.onDidCloseTextDocument((td) => {
			const filePath = fsPath(td.uri);
			delete this.closingLabels[filePath];
		}));
		if (vs.window.activeTextEditor)
			this.update();
	}

	private update() {
		const editor = vs.window.activeTextEditor;
		if (!editor || !editor.document)
			return;

		const filePath = fsPath(vs.window.activeTextEditor.document.uri);
		if (!this.closingLabels[filePath])
			return;

		const decorations: { [key: number]: vs.DecorationOptions } = [];
		for (const r of this.closingLabels[filePath].labels) {
			const finalCharacterPosition = r.range.end;
			const finalCharacterRange =
				finalCharacterPosition.character > 0
					? new vs.Range(
						new vs.Position(finalCharacterPosition.line, finalCharacterPosition.character - 1),
						new vs.Position(finalCharacterPosition.line, finalCharacterPosition.character),
					)
					: new vs.Range(
						new vs.Position(finalCharacterPosition.line, finalCharacterPosition.character),
						new vs.Position(finalCharacterPosition.line, finalCharacterPosition.character + 1),
					);
			const finalCharacterText = editor.document.getText(finalCharacterRange);
			const endOfLine = editor.document.lineAt(finalCharacterPosition.line).range.end;

			// We won't update if we had any bad notifications as this usually means either bad code resulted
			// in wonky results or the document was updated before the notification came back.
			if (finalCharacterText !== "]" && finalCharacterText !== ")")
				return;

			const existingDecorationForLine = decorations[endOfLine.line];
			if (existingDecorationForLine) {
				existingDecorationForLine.renderOptions.after.contentText = " // " + r.label + " " + existingDecorationForLine.renderOptions.after.contentText;
			} else {
				const dec = {
					range: new vs.Range(new vs.Position(r.range.start.line, r.range.start.character), endOfLine),
					renderOptions: { after: { contentText: " // " + r.label } },
				};
				decorations[endOfLine.line] = dec;
			}
		}

		editor.setDecorations(this.decorationType, Object.keys(decorations).map((k) => parseInt(k, 10)).map((k) => decorations[k]));
	}

	public dispose() {
		this.subscriptions.forEach((s) => s.dispose());
	}
}
