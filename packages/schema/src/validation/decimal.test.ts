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

test("multiplyQuantityByMoney matches bigint reference across scale combos", () => {
	function refMultiply(qty: number, price: string, minorUnits: number): string {
		const qtyScaled = BigInt(Math.round(qty * 1000));
		const [, fracP = ""] = price.split(".");
		const priceScale = fracP.length;
		const [intP = "0"] = price.split(".");
		const priceScaled =
			BigInt(intP) * 10n ** BigInt(priceScale) +
			BigInt(fracP.padEnd(priceScale, "0").slice(0, priceScale) || "0");
		const productScaled = qtyScaled * priceScaled;
		const productScale = 3 + priceScale;

		if (productScale <= minorUnits) {
			const scaled = productScaled * 10n ** BigInt(minorUnits - productScale);
			return formatRef(scaled, minorUnits);
		}

		const scaleDiff = productScale - minorUnits;
		const divisor = 10n ** BigInt(scaleDiff);
		const halfUnit = 5n * 10n ** BigInt(scaleDiff - 1);
		const remainder = productScaled % divisor;
		let rounded = productScaled / divisor;
		if (remainder >= halfUnit) {
			rounded += 1n;
		}
		return formatRef(rounded, minorUnits);
	}

	function formatRef(scaled: bigint, minorUnits: number): string {
		if (minorUnits === 0) {
			return scaled.toString();
		}
		const scaleFactor = 10n ** BigInt(minorUnits);
		const integerPart = scaled / scaleFactor;
		const fractionalPart = (scaled % scaleFactor)
			.toString()
			.padStart(minorUnits, "0");
		return `${integerPart}.${fractionalPart}`;
	}

	for (let qtyDec = 0; qtyDec <= 3; qtyDec++) {
		for (let priceDec = 0; priceDec <= 2; priceDec++) {
			for (let qi = 0; qi < 10; qi++) {
				for (let pi = 0; pi < 10; pi++) {
					const qty = qi / 10 ** (qtyDec || 0);
					const price =
						priceDec === 0
							? String(pi)
							: `${pi}.${String(pi % 10 ** priceDec).padStart(priceDec, "0")}`;
					for (const minorUnits of [0, 2] as const) {
						expect(multiplyQuantityByMoney(qty, price, minorUnits)).toBe(
							refMultiply(qty, price, minorUnits),
						);
					}
				}
			}
		}
	}
});

test("addMoneyAmounts handles large values and many items without drift", () => {
	expect(addMoneyAmounts(["9999999999999.99", "0.01"], 2)).toBe(
		"10000000000000.00",
	);
	expect(
		addMoneyAmounts(
			Array.from({ length: 25 }, () => "100.00"),
			2,
		),
	).toBe("2500.00");
});
