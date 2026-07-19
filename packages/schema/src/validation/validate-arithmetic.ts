import type { DocumentPayload } from "../document/document-payload";
import {
	LINE_TOTAL_MISMATCH_CODE,
	TAX_TOTAL_MISMATCH_CODE,
	VALIDATION_FAILED_CODE,
} from "./codes";
import {
	getCurrencyMinorUnits,
	validateMoneyMinorUnits,
} from "./currency-minor-units";
import {
	addMoneyAmounts,
	compareMoneyAmounts,
	multiplyQuantityByMoney,
	normalizeMoneyAmount,
	subtractMoneyAmounts,
} from "./decimal";
import type { BusinessRuleFinding } from "./finding";

function minorUnitFinding(
	path: string,
	reason: string,
	received: string,
): BusinessRuleFinding {
	return {
		path,
		code: VALIDATION_FAILED_CODE,
		message: reason,
		received,
	};
}

function moneyMismatchFinding(
	path: string,
	code: typeof LINE_TOTAL_MISMATCH_CODE | typeof TAX_TOTAL_MISMATCH_CODE,
	message: string,
	expected: string,
	received: string,
): BusinessRuleFinding {
	return {
		path,
		code,
		message,
		expected,
		received,
	};
}

function validationFailedMoneyMismatch(
	path: string,
	message: string,
	expected: string,
	received: string,
): BusinessRuleFinding {
	return {
		path,
		code: VALIDATION_FAILED_CODE,
		message,
		expected,
		received,
	};
}

function collectMinorUnitFindings(
	payload: DocumentPayload,
): BusinessRuleFinding[] {
	const findings: BusinessRuleFinding[] = [];
	const currency = payload.currency;

	for (const [index, lineItem] of payload.lineItems.entries()) {
		for (const [field, amount] of [
			["unitPrice", lineItem.unitPrice.amount],
			["lineTotal", lineItem.lineTotal.amount],
		] as const) {
			const result = validateMoneyMinorUnits(amount, currency);
			if (!result.valid) {
				findings.push(
					minorUnitFinding(
						`/lineItems/${index}/${field}`,
						result.reason,
						amount,
					),
				);
			}
		}
	}

	if (payload.taxLines) {
		for (const [index, taxLine] of payload.taxLines.entries()) {
			const result = validateMoneyMinorUnits(taxLine.amount.amount, currency);
			if (!result.valid) {
				findings.push(
					minorUnitFinding(
						`/taxLines/${index}/amount`,
						result.reason,
						taxLine.amount.amount,
					),
				);
			}
		}
	}

	if (payload.discount) {
		const result = validateMoneyMinorUnits(payload.discount.amount, currency);
		if (!result.valid) {
			findings.push(
				minorUnitFinding("/discount", result.reason, payload.discount.amount),
			);
		}
	}

	for (const [field, amount] of [
		["subtotal", payload.totals.subtotal.amount],
		["taxTotal", payload.totals.taxTotal.amount],
		["grandTotal", payload.totals.grandTotal.amount],
	] as const) {
		const result = validateMoneyMinorUnits(amount, currency);
		if (!result.valid) {
			findings.push(
				minorUnitFinding(`/totals/${field}`, result.reason, amount),
			);
		}
	}

	return findings;
}

export function validateDocumentPayloadArithmetic(
	payload: DocumentPayload,
): BusinessRuleFinding[] {
	const findings: BusinessRuleFinding[] = [];
	const minorUnits = getCurrencyMinorUnits(payload.currency);

	findings.push(...collectMinorUnitFindings(payload));

	for (const [index, lineItem] of payload.lineItems.entries()) {
		const expectedLineTotal = multiplyQuantityByMoney(
			lineItem.quantity,
			lineItem.unitPrice.amount,
			minorUnits,
		);
		const normalizedExpected = normalizeMoneyAmount(
			expectedLineTotal,
			minorUnits,
		);
		const normalizedReceived = normalizeMoneyAmount(
			lineItem.lineTotal.amount,
			minorUnits,
		);

		if (
			compareMoneyAmounts(
				normalizedExpected,
				normalizedReceived,
				minorUnits,
			) !== 0
		) {
			findings.push(
				moneyMismatchFinding(
					`/lineItems/${index}/lineTotal`,
					LINE_TOTAL_MISMATCH_CODE,
					`lineTotal must equal quantity × unitPrice rounded half-up to currency minor units`,
					normalizedExpected,
					normalizedReceived,
				),
			);
		}
	}

	const sumLineTotals = addMoneyAmounts(
		payload.lineItems.map((lineItem) => lineItem.lineTotal.amount),
		minorUnits,
	);
	const normalizedSubtotalExpected = normalizeMoneyAmount(
		sumLineTotals,
		minorUnits,
	);
	const normalizedSubtotalReceived = normalizeMoneyAmount(
		payload.totals.subtotal.amount,
		minorUnits,
	);

	if (
		compareMoneyAmounts(
			normalizedSubtotalExpected,
			normalizedSubtotalReceived,
			minorUnits,
		) !== 0
	) {
		findings.push(
			validationFailedMoneyMismatch(
				"/totals/subtotal",
				"subtotal must equal the sum of line item totals",
				normalizedSubtotalExpected,
				normalizedSubtotalReceived,
			),
		);
	}

	if (payload.taxLines && payload.taxLines.length > 0) {
		const sumTaxLines = addMoneyAmounts(
			payload.taxLines.map((taxLine) => taxLine.amount.amount),
			minorUnits,
		);
		const normalizedTaxExpected = normalizeMoneyAmount(sumTaxLines, minorUnits);
		const normalizedTaxReceived = normalizeMoneyAmount(
			payload.totals.taxTotal.amount,
			minorUnits,
		);

		if (
			compareMoneyAmounts(
				normalizedTaxExpected,
				normalizedTaxReceived,
				minorUnits,
			) !== 0
		) {
			findings.push(
				moneyMismatchFinding(
					"/totals/taxTotal",
					TAX_TOTAL_MISMATCH_CODE,
					"taxTotal must equal the sum of tax line amounts",
					normalizedTaxExpected,
					normalizedTaxReceived,
				),
			);
		}
	}

	const subtotalAmount = payload.totals.subtotal.amount;

	if (payload.discount) {
		if (
			compareMoneyAmounts(payload.discount.amount, subtotalAmount, minorUnits) >
			0
		) {
			findings.push({
				path: "/discount",
				code: VALIDATION_FAILED_CODE,
				message: "discount must not exceed subtotal",
				expected: normalizeMoneyAmount(subtotalAmount, minorUnits),
				received: normalizeMoneyAmount(payload.discount.amount, minorUnits),
			});
		}
	}

	const discountAmount = payload.discount?.amount ?? "0";
	const taxTotalAmount = payload.totals.taxTotal.amount;
	let expectedGrandTotal: string;

	if (payload.pricesIncludeTax === true) {
		expectedGrandTotal = subtractMoneyAmounts(
			subtotalAmount,
			discountAmount,
			minorUnits,
		);
	} else {
		expectedGrandTotal = addMoneyAmounts(
			[
				subtractMoneyAmounts(subtotalAmount, discountAmount, minorUnits),
				taxTotalAmount,
			],
			minorUnits,
		);
	}

	const normalizedGrandExpected = normalizeMoneyAmount(
		expectedGrandTotal,
		minorUnits,
	);
	const normalizedGrandReceived = normalizeMoneyAmount(
		payload.totals.grandTotal.amount,
		minorUnits,
	);

	if (
		compareMoneyAmounts(
			normalizedGrandExpected,
			normalizedGrandReceived,
			minorUnits,
		) !== 0
	) {
		findings.push(
			validationFailedMoneyMismatch(
				"/totals/grandTotal",
				payload.pricesIncludeTax === true
					? "grandTotal must equal subtotal minus discount when pricesIncludeTax is true"
					: "grandTotal must equal subtotal minus discount plus taxTotal when pricesIncludeTax is false",
				normalizedGrandExpected,
				normalizedGrandReceived,
			),
		);
	}

	return findings;
}
