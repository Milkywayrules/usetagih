import { expect, test } from "bun:test";
import { type RenderRepo, validateUseCase } from "./index.js";

test("public exports include ports and validateUseCase", () => {
	expect(typeof validateUseCase).toBe("function");
	const renderRepoShape: RenderRepo = {
		insert: async () => {
			throw new Error("stub");
		},
		getByIdAndWorkspace: async () => null,
		listByWorkspace: async () => [],
	};
	expect(renderRepoShape).toBeDefined();
});
