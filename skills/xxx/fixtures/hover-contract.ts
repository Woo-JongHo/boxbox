/** Concise semantic type for a task result. */
export type CompactResult = { value: string };

/** Input the caller may omit. */
export interface HoverOptions {
	/** Creates a new resource when omitted. */
	resourceId ?: string;
}

/** Stored normalized result. */
export interface StoredOptions {
	/** null means no linked resource. */
	resourceId : string | null;
}

export type MissingDocumentation = string;
