type KindManifest = {
	schemaVersion: 1;
	name: string;
	createdAt: string;
};

export interface MethodContract {
	runFirst(first: string): Promise<void>;
	runSecond(second: number, extra: string): void;
	listAll(): Promise<string[]>;
}

type AppOptions = RunOptions;
type SessionList = RecentSessionSummary[];
type ThreadSelection = string | null;

const alpha: string = "a";
const beta: number = 22;
const gamma: boolean = true;

const width = 1920;
const height = 1080;
const depth = 3;

const value = chars[index]!;
const next = chars[index + 1];

const rails = {
	dashboard: new DashboardRail(get, synthetic),
	workflow: new WorkflowRail(get, synthetic),
	context: new ContextRail(get, synthetic),
};

enum Level {
	Low = 1,
	Middle = 22,
	High = 333,
}

function pick(input: string): string {
	switch (input) {
		case "a": return "first";
		case "bb": return "second";
		case "ccc": return "third";
		default: return "rest";
	}
}

function guardSample(value: string, next: string, state: string): void {
	for (;;) {
		if (value === "/" && next === "/") { state = "line"; index += 1; continue; }
		if (value === "/" && next === "*") { state = "block"; index += 1; continue; }
		if (value === "`") { state = "template"; continue; }
		if (value === "'") { state = "single"; continue; }
		if (value === '"') { state = "double"; continue; }
		break;
	}
}

