import      {
              closeSync             ,
              chmodSync             ,
              constants             ,
              existsSync            ,
              lstatSync             ,
              openSync              ,
              readFileSync          ,
              renameSync            ,
              unlinkSync            ,
              writeFileSync         ,
                                      } from "node:fs"     ;
import      { basename, dirname, join } from "node:path"   ;
import      { randomUUID              } from "node:crypto" ;

interface FileIdentity {
	readonly dev     : number ;
	readonly ino     : number ;
	readonly mode    : number ;
	readonly size    : number ;
	readonly mtimeMs : number ;
	readonly ctimeMs : number ;
}

export interface SafeFileOperations {
	readonly beforeCommit? : (target: string, working: string) => void ;
	readonly rename?       : (from: string, to: string) => void        ;
}

export interface StagedFile {
	readonly initial : Buffer ;
	readonly working : string ;
}

interface PreparedUpdate extends StagedFile {
	readonly target           : string       ;
	readonly lock             : string       ;
	readonly lockDescriptor   : number       ;
	readonly originalIdentity : FileIdentity ;
}

function identity(path: string): FileIdentity {
	const value = lstatSync(path);
	if (value.isSymbolicLink()) throw new Error(`refusing to replace symbolic link: ${path}`);
	if (!value.isFile()) throw new Error(`refusing to replace non-regular file: ${path}`);
	if (value.nlink !== 1) throw new Error(`refusing to replace multiply-linked file: ${path}`);
	return { dev: value.dev, ino: value.ino, mode: value.mode, size: value.size, mtimeMs: value.mtimeMs, ctimeMs: value.ctimeMs };
}

function sameIdentity(left: FileIdentity, right: FileIdentity): boolean {
	return left.dev === right.dev && left.ino === right.ino && left.mode === right.mode && left.size === right.size && left.mtimeMs === right.mtimeMs && left.ctimeMs === right.ctimeMs;
}

function prepareUpdate(target: string): PreparedUpdate {
	const directory = dirname(target)                  ;
	const nonce     = `${process.pid}.${randomUUID()}` ;
	// 원래 basename을 끝에 그대로 두어 .d.ts/.d.mts/.tsx 같은 TypeScript 파일 의미를 보존한다.
	const working = join(directory, `.xxx-stage.${nonce}.${basename(target)}`) ;
	const lock    = join(directory, `.${basename(target)}.xxx-write.lock`    ) ;

	let lockDescriptor: number;
	try {
		lockDescriptor = openSync(lock, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
	} catch (error) {
		throw new Error(`another writer is updating the file: ${target}`, { cause: error });
	}

	try {
		const originalIdentity = identity(target)                                                                                             ;
		const initial          = readFileSync(target)                                                                                         ;
		const descriptor       = openSync(working, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, originalIdentity.mode & 0o7777) ;
		try { writeFileSync(descriptor, initial); }
		finally { closeSync(descriptor); }
		chmodSync(working, originalIdentity.mode & 0o7777);
		return { target, initial, working, lock, lockDescriptor, originalIdentity };
	} catch (error) {
		if (existsSync(working)) unlinkSync(working);
		closeSync(lockDescriptor);
		if (existsSync(lock)) unlinkSync(lock);
		throw error;
	}
}

function commitUpdate(prepared: PreparedUpdate, operations: SafeFileOperations): boolean {
	const { target, initial, working, originalIdentity } = prepared;
	const output = readFileSync(working);
	if (output.equals(initial)) return false;

	operations.beforeCommit?.(target, working);
	let currentIdentity: FileIdentity;
	try { currentIdentity = identity(target); }
	catch (error) { throw new Error(`target changed before commit: ${target}`, { cause: error }); }
	if (!sameIdentity(originalIdentity, currentIdentity) || !readFileSync(target).equals(initial)) throw new Error(`target changed before commit: ${target}`);

	chmodSync(working, originalIdentity.mode & 0o7777);
	(operations.rename ?? renameSync)(working, target);
	return true;
}

function cleanupUpdate(prepared: PreparedUpdate): void {
	if (existsSync(prepared.working)) unlinkSync(prepared.working);
	closeSync(prepared.lockDescriptor);
	if (existsSync(prepared.lock)) unlinkSync(prepared.lock);
}

/**
 * 대상과 같은 디렉터리·확장자의 작업본에서 변경을 끝낸 뒤 한 번만 교체한다.
 * 잠금은 이 helper를 쓰는 writer끼리만 협력하며, commit 직전 identity와 bytes를 다시 확인한다.
 */
export async function updateFileAtomically(target: string, update: (file: StagedFile) => Promise<void>, operations: SafeFileOperations = {}): Promise<boolean> {
	const prepared = prepareUpdate(target);
	try {
		await update(prepared);
		return commitUpdate(prepared, operations);
	} finally { cleanupUpdate(prepared); }
}

/** 동기 parser를 쓰는 line engine을 위한 같은 안전 계약의 동기 진입점. */
export function updateFileAtomicallySync(target: string, update: (file: StagedFile) => void, operations: SafeFileOperations = {}): boolean {
	const prepared = prepareUpdate(target);
	try {
		update(prepared);
		return commitUpdate(prepared, operations);
	} finally { cleanupUpdate(prepared); }
}
