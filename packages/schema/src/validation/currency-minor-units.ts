const CURRENCY_MINOR_UNITS: Record<string, number> = {
	JPY: 0,
	USD: 2,
	EUR: 2,
	GBP: 2,
};

export function getCurrencyMinorUnits(currency: string): number {
	return CURRENCY_MINOR_UNITS[currency] ?? 2;
}

export function validateMoneyMinorUnits(
	amount: string,
	currency: string,
): { valid: true } | { valid: false; reason: string } {
	const minorUnits = getCurrencyMinorUnits(currency);

	if (minorUnits === 0) {
		if (amount.includes(".")) {
			return {
				valid: false,
				reason:
					"JPY amounts must be whole yen with no decimal point (FR-4 integer-yen rule)",
			};
		}
		return { valid: true };
	}

	const [, fractional = ""] = amount.split(".");
	if (fractional.length > minorUnits) {
		return {
			valid: false,
			reason: `amount exceeds ${minorUnits} decimal places for ${currency} (FR-4)`,
		};
	}

	return { valid: true };
}
