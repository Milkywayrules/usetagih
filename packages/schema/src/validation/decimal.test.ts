import { expect, test } from "bun:test";
import {
	addMoneyAmounts,
	compareMoneyAmounts,
	multiplyQuantityByMoney,
	normalizeMoneyAmount,
	subtractMoneyAmounts,
} from "./decimal";

test("multiplyQuantityByMoney half-up rounding vectors", () => {
	const cases = [
		{ quantity: 10, unitPrice: "9.99", minorUnits: 2, expected: "99.90" },
		{ quantity: 3, unitPrice: "0.335", minorUnits: 2, expected: "1.01" },
		{ quantity: 1, unitPrice: "0.005", minorUnits: 2, expected: "0.01" },
		{ quantity: 2, unitPrice: "149.00", minorUnits: 2, expected: "298.00" },
		{ quantity: 1000, unitPrice: "1", minorUnits: 0, expected: "1000" },
	] as const;

	for (const testCase of cases) {
		expect(
			multiplyQuantityByMoney(
				testCase.quantity,
				testCase.unitPrice,
				testCase.minorUnits,
			),
		).toBe(testCase.expected);
	}
});

test("addMoneyAmounts sums with half-up at minor units", () => {
	expect(addMoneyAmounts(["99.90", "8.24"], 2)).toBe("108.14");
	expect(addMoneyAmounts(["622.00", "51.56"], 2)).toBe("673.56");
});

test("subtractMoneyAmounts subtracts with half-up at minor units", () => {
	expect(subtractMoneyAmounts("622.00", "0", 2)).toBe("622.00");
	expect(subtractMoneyAmounts("99.90", "10.00", 2)).toBe("89.90");
});

test("compareMoneyAmounts compares normalized values", () => {
	expect(compareMoneyAmounts("99.90", "99.9", 2)).toBe(0);
	expect(compareMoneyAmounts("99.91", "99.90", 2)).toBe(1);
	expect(compareMoneyAmounts("99.89", "99.90", 2)).toBe(-1);
});

test("normalizeMoneyAmount canonicalizes decimal strings", () => {
	expect(normalizeMoneyAmount("99.9", 2)).toBe("99.90");
	expect(normalizeMoneyAmount("1000", 0)).toBe("1000");
});
