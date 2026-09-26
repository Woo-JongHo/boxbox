/**
 * 언어 무관 표 엔진. 프로파일러가 한 행을 같은 축 나열(시그니처)로 분해하면, 이 엔진이
 * 연속 행을 엑셀 표로 묶고 열 축을 실제 최장 셀 기준의 최소 폭으로 맞춘다.
 *
 * 안전 규칙:
 * 1. 프로파일 슬롯을 원본 간격 그대로 재조합해 코드 부분과 다르면 그 행은 거부한다(손실 분해 금지).
 * 2. 빈 줄·주석 줄·블록 주석 내부·프로파일 거부 행은 영역을 끊는다 — 서로 다른 구획이 폭을 공유하지 않는다.
 * 3. minRows 미만 연속(기본 2행)은 보고만 하고 정렬하지 않는다.
 */
import { displayWidth } from "./display-width.ts";
import { maskSource, type CodeSyntax } from "./code-text.ts";

/** 프로파일러가 CodeSyntax를 table-engine에서 바로 가져갈 수 있게 다시 내보낸다. */
export type { CodeSyntax };

export interface Slot {
	/** 셀 역할. 프로파일러가 언어별로 정의한다(name·type·value·colon·equal·semicolon·comma 등). */
	readonly axis      : string;
	/** 원본에서 그대로 자른 셀 내용(양쪽 공백 없음). */
	readonly text      : string;
	/** 원본에서 이 셀 앞에 있던 실제 간격. 무손실 검증에만 쓰고 재조합에는 정규 간격을 쓴다. */
	readonly gapBefore : string;
}

export interface RowProfile {
	readonly indent : string;
	readonly slots  : readonly Slot[];
}

export interface LineProfiler {
	readonly language      : string;
	readonly syntax        : CodeSyntax;
	/** 이 축의 셀은 열 폭에 맞춰 오른쪽이 패딩된다(비교 대상 열). */
	readonly columnAxes    : readonly string[];
	/** 재조합 때 쓸 축별 정규 간격. 없는 축은 " "로 둔다. */
	readonly canonicalGaps : Readonly<Record<string, string>>;
	/** 표 행으로 인정되면 분해를, 아니면 null을 돌려준다. code는 주석 꼬리가 잘린 원본, masked는 같은 좌표의 마스크다. */
	profile(code: string, masked: string): RowProfile | null;
}

export interface TableEdit {
	readonly index  : number;
	readonly before : string;
	readonly after  : string;
}

export interface DetectedTable {
	readonly startLine : number;
	readonly endLine   : number;
	readonly rows      : number;
	readonly axes      : readonly string[];
	readonly widths    : readonly number[];
	readonly edits     : readonly TableEdit[];
}

export interface PairGroup {
	readonly startLine : number;
	readonly endLine   : number;
	readonly rows      : number;
	readonly signature : string;
}

export interface AlignResult {
	readonly output     : string;
	/** 2행 이상 시그니처 연속 구간 수. */
	readonly groups     : number;
	/** minRows 이상으로 실제 정렬된 표 수. */
	readonly tables     : number;
	/** 정렬했다면 바뀌는 행 수. */
	readonly misaligned : number;
	/** apply=true일 때 실제 적용된 행 수. */
	readonly edits      : number;
	readonly details    : readonly DetectedTable[];
	readonly pairs      : readonly PairGroup[];
}

export interface AlignOptions {
	readonly minRows : number;
	/** false면 보고만 하고 output을 원본으로 둔다. */
	readonly apply   : boolean;
}

const canonicalGap = (aligner: LineProfiler, axis: string): string => aligner.canonicalGaps[axis] ?? " ";

function signatureOf(profile: RowProfile): string {
	return `${profile.indent}|${profile.slots.map(slot => slot.axis).join(">")}`;
}

function rebuildCode(aligner: LineProfiler, profile: RowProfile, widths: readonly number[] | null): string {
	const parts: string[] = [profile.indent];
	profile.slots.forEach((slot, position) => {
		if (position > 0) parts.push(canonicalGap(aligner, slot.axis));
		if (widths !== null && aligner.columnAxes.includes(slot.axis)) {
			const pad = widths[position] - displayWidth(slot.text);
			parts.push(pad > 0 ? slot.text + " ".repeat(pad) : slot.text);
		} else {
			parts.push(slot.text);
		}
	});
	return parts.join("");
}

export function alignSource(source: string, aligner: LineProfiler, options: AlignOptions): AlignResult {
	const minRows = Math.max(2, options.minRows);
	const mask    = maskSource(source, aligner.syntax);
	const lines       = source.split("\n");
	const maskedLines = mask.text.split("\n");

	interface Accepted { readonly index: number; readonly profile: RowProfile; readonly comment: string | null; }
	const accepted: Accepted[] = [];

	lines.forEach((line, index) => {
		if (mask.opensInBlock[index]) return;
		const commentStart = mask.commentStarts[index];
		const codeEnd   = commentStart >= 0 ? commentStart : line.length;
		const comment   = codeEnd < line.length ? line.slice(codeEnd).trim() : null;
		// 주석 앞의 남는 공백은 재조합 때 계산된 간격으로 대체되므로 코드 부분에서 제거한다.
		const code       = comment !== null ? line.slice(0, codeEnd).replace(/\s+$/u, "") : line.slice(0, codeEnd);
		const maskedCode = comment !== null ? maskedLines[index].slice(0, codeEnd).replace(/\s+$/u, "") : maskedLines[index].slice(0, codeEnd);
		if (maskedCode.trim() === "") return;
		const profile = aligner.profile(code, maskedCode);
		if (!profile) return;
		const lossless = profile.indent + profile.slots.map((slot, position) => position === 0 ? slot.text : slot.gapBefore + slot.text).join("") === code;
		if (!lossless) return;
		accepted.push({ index, profile, comment });
	});

	const runs: Accepted[][] = [];
	let current: Accepted[] = [];
	const flush = (): void => {
		if (current.length >= 2) runs.push(current);
		current = [];
	};
	for (let position = 0; position < accepted.length; position += 1) {
		const row = accepted[position];
		const previous = current[current.length - 1];
		const contiguous = !previous || previous.index === row.index - 1;
		const sameShape  = previous && signatureOf(previous.profile) === signatureOf(row.profile);
		if (contiguous && sameShape) current.push(row);
		else { flush(); current = [row]; }
	}
	flush();

	const details: DetectedTable[] = [];
	const pairs: PairGroup[] = [];
	const editsByLine = new Map<number, TableEdit>();

	for (const run of runs) {
		const signature = signatureOf(run[0].profile);
		if (run.length < minRows) {
			pairs.push({ startLine: run[0].index + 1, endLine: run[run.length - 1].index + 1, rows: run.length, signature });
			continue;
		}
		const widths = run[0].profile.slots.map((_, position) =>
			Math.max(...run.map(row => displayWidth(row.profile.slots[position].text))),
		);
		const alignedCodes = run.map(row => rebuildCode(aligner, row.profile, widths));
		const commentRows = run.map(row => row.comment !== null);
		const commentColumn = Math.max(
			0,
			...run.map((row, position) => commentRows[position] ? displayWidth(alignedCodes[position]) : 0),
		) + (commentRows.some(Boolean) ? 1 : 0);
		const tableEdits: TableEdit[] = [];
		run.forEach((row, position) => {
			const code = alignedCodes[position];
			const after = row.comment !== null
				? code + " ".repeat(commentColumn - displayWidth(code)) + row.comment
				: code;
			if (after === lines[row.index]) return;
			const edit: TableEdit = { index: row.index, before: lines[row.index], after };
			tableEdits.push(edit);
			if (options.apply) editsByLine.set(row.index, edit);
		});
		details.push({
			startLine : run[0].index + 1,
			endLine   : run[run.length - 1].index + 1,
			rows      : run.length,
			axes      : run[0].profile.slots.map(slot => slot.axis),
			widths,
			edits     : tableEdits,
		});
	}

	const output = options.apply
		? lines.map((line, index) => editsByLine.get(index)?.after ?? line).join("\n")
		: source;
	const misaligned = new Set(details.flatMap(table => table.edits.map(edit => edit.index))).size;
	return {
		output,
		groups: runs.length,
		tables: details.length,
		misaligned,
		edits: options.apply ? misaligned : 0,
		details,
		pairs,
	};
}
