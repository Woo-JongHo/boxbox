import { createHash, randomUUID } from "node:crypto";

export interface ApprovalPreview {
	readonly projectRelativeFile : string                                                                        ;
	readonly targetSha256        : string                                                                        ;
	readonly ruleKey             : string                                                                        ;
	readonly fileScope           : string                                                                        ;
	readonly groups              : readonly { startLine: number; endLine: number; kind: string }[]               ;
	readonly examples            : readonly { label: "fixed" | "preservation"; before: string; after: string }[] ;
}
export interface ApprovalRequest extends ApprovalPreview {
	readonly schemaVersion : 1                                    ;
	readonly kind          : "boxbox-approval-request"            ;
	readonly digest        : string                               ;
	readonly correlation   : string                               ;
	readonly choices       : readonly ["approve", "keep-preview"] ;
}
export interface HostDeliveryObservation {
	readonly interactiveControls : boolean ;
	readonly requestAccepted     : boolean ;
	readonly visibleConfirmed    : boolean ;
}
export interface ApprovalDelivery {
	readonly channel : "native-card" | "conversation" ;
	readonly request : ApprovalRequest                ;
	readonly notice  : string                         ;
}

const sha256 = (value: string): string => `sha256:${createHash("sha256").update(value).digest("hex")}`;

function canonical(preview: ApprovalPreview): string {
	return JSON.stringify({ projectRelativeFile: preview.projectRelativeFile, targetSha256: preview.targetSha256, ruleKey: preview.ruleKey, fileScope: preview.fileScope, groups: preview.groups.map(group => [group.startLine, group.endLine, group.kind]), examples: preview.examples.map(example => [example.label, example.before, example.after]) });
}

function validatePreview(preview: ApprovalPreview): void {
	if (!preview.projectRelativeFile || preview.projectRelativeFile.startsWith("/") || preview.projectRelativeFile.split(/[\\/]/u).includes("..")) throw new Error("approval target must be a project-relative file");
	if (!/^sha256:[0-9a-f]{64}$/u.test(preview.targetSha256)) throw new Error("approval request needs the current target SHA-256");
	if (!preview.ruleKey || !preview.fileScope) throw new Error("approval request needs an exact rule key and file scope");
	if (preview.groups.length === 0) throw new Error("approval request needs at least one affected group");
	if (!preview.examples.some(example => example.label === "fixed") || !preview.examples.some(example => example.label === "preservation")) throw new Error("approval request needs fixed and preservation examples");
}

/** Builds an immutable request whose digest binds the exact file, rule, scope, groups and preview bytes. */
export function approvalRequest(preview: ApprovalPreview): ApprovalRequest {
	validatePreview(preview);
	return { schemaVersion: 1, kind: "boxbox-approval-request", ...preview, digest: sha256(canonical(preview)), correlation: randomUUID(), choices: ["approve", "keep-preview"] };
}

/** Host acceptance is not visibility. Without observable confirmation, use the conversation fallback. */
export function approvalDelivery(request: ApprovalRequest, observation: HostDeliveryObservation): ApprovalDelivery {
	const visible = observation.interactiveControls && observation.requestAccepted && observation.visibleConfirmed;
	return visible ? { channel: "native-card", request, notice: `Approval card visible for ${request.digest} (${request.correlation})` } : { channel: "conversation", request, notice: `Native approval visibility was not confirmed. Reply Approve or Keep preview for ${request.digest} (${request.correlation})` };
}
