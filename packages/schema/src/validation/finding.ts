import type { ErrorCode } from "../errors/codes";

export type BusinessRuleFinding = {
	path: string;
	code: ErrorCode;
	message: string;
	expected?: string;
	received?: string;
};
