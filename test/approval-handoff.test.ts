import { describe, expect, test } from "bun:test";

import { approvalDelivery, approvalRequest } from "@/common/42_approval-handoff.ts";

const request = () => approvalRequest({
	projectRelativeFile : "src/pilot.ts"                                                                                                                                            ,
	targetSha256        : "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"                                                                                 ,
	ruleKey             : "v1|typescript|SourceFile|declaration-equals|equals>semicolon"                                                                                            ,
	fileScope           : "src/pilot.ts"                                                                                                                                            ,
	groups              : [{ startLine: 2, endLine: 4, kind: "declaration-equals" }]                                                                                                ,
	examples            : [{ label: "fixed", before: "const a = 1;\n", after: "const a = 1;\n" }, { label: "preservation", before: "const a = /x/;\n", after: "const a = /x/;\n" }] ,
});
describe("approval handoff", () => {
	test("uses a native card only after visible delivery is observed", () => {
		const proposal = request();
		expect(approvalDelivery(proposal, { interactiveControls: true, requestAccepted: true, visibleConfirmed: true }).channel).toBe("native-card");
	});
	test("falls back after accepted but unconfirmed delivery and without controls", () => {
		const proposal = request         ()                                                                                        ;
		const accepted = approvalDelivery(proposal, { interactiveControls: true, requestAccepted: true, visibleConfirmed: false }) ;
		expect(accepted                                                                                                           ).toMatchObject({ channel: "conversation", request: proposal }) ;
		expect(accepted.notice                                                                                                    ).toContain    (proposal.digest                               ) ;
		expect(approvalDelivery(proposal, { interactiveControls: false, requestAccepted: false, visibleConfirmed: false }).channel).toBe         ("conversation"                                ) ;
	});
});
