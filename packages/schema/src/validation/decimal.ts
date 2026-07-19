type ScaledAmount = bigint;

function parseAmountParts(amount: string): {
	integerPart: bigint;
	fractionalPart: string;
} {
	const [integerString = "0", fractionalPart = ""] = amount.split(".");
	return {
		integerPart: BigInt(integerString === "" ? "0" : integerString),
		fractionalPart,
	};
}

function amountToScaledAtScale(amount: string, scale: number): ScaledAmount {
	const { integerPart, fractionalPart } = parseAmountParts(amount);
	const paddedFraction = fractionalPart.padEnd(scale, "0").slice(0, scale);
	const fractionalScaled =
		paddedFraction.length > 0 ? BigInt(paddedFraction) : 0n;
	const scaleFactor = 10n ** BigInt(scale);
	return integerPart * scaleFactor + fractionalScaled;
}

function roundHalfUp(
	scaled: ScaledAmount,
	fromScale: number,
	toScale: number,
): ScaledAmount {
	if (fromScale <= toScale) {
		return scaled * 10n ** BigInt(toScale - fromScale);
	}

	const scaleDiff = fromScale - toScale;
	const divisor = 10n ** BigInt(scaleDiff);
	const halfUnit = 5n * 10n ** BigInt(scaleDiff - 1);
	const remainder = scaled % divisor;
	let rounded = scaled / divisor;

	if (remainder >= halfUnit) {
		rounded += 1n;
	}

	return rounded;
}

function parseMoneyToScaled(amount: string, minorUnits: number): ScaledAmount {
	const { fractionalPart } = parseAmountParts(amount);
	const sourceScale = fractionalPart.length;
	const scaledAtSource = amountToScaledAtScale(amount, sourceScale);

	if (sourceScale <= minorUnits) {
		return scaledAtSource * 10n ** BigInt(minorUnits - sourceScale);
	}

	return roundHalfUp(scaledAtSource, sourceScale, minorUnits);
}

function scaledToMoneyString(scaled: ScaledAmount, minorUnits: number): string {
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

export function normalizeMoneyAmount(
	amount: string,
	minorUnits: number,
): string {
	return scaledToMoneyString(
		parseMoneyToScaled(amount, minorUnits),
		minorUnits,
	);
}

export function compareMoneyAmounts(
	a: string,
	b: string,
	minorUnits: number,
): -1 | 0 | 1 {
	const scaledA = parseMoneyToScaled(a, minorUnits);
	const scaledB = parseMoneyToScaled(b, minorUnits);

	if (scaledA < scaledB) {
		return -1;
	}
	if (scaledA > scaledB) {
		return 1;
	}
	return 0;
}

export function addMoneyAmounts(amounts: string[], minorUnits: number): string {
	let sum = 0n;
	for (const amount of amounts) {
		sum += parseMoneyToScaled(amount, minorUnits);
	}
	return scaledToMoneyString(sum, minorUnits);
}

export function subtractMoneyAmounts(
	minuend: string,
	subtrahend: string,
	minorUnits: number,
): string {
	const scaledMinuend = parseMoneyToScaled(minuend, minorUnits);
	const scaledSubtrahend = parseMoneyToScaled(subtrahend, minorUnits);
	return scaledToMoneyString(scaledMinuend - scaledSubtrahend, minorUnits);
}

export function multiplyQuantityByMoney(
	quantity: number,
	unitPriceAmount: string,
	minorUnits: number,
): string {
	const quantityScale = 3;
	const quantityScaled = BigInt(Math.round(quantity * 1000));
	const { fractionalPart } = parseAmountParts(unitPriceAmount);
	const priceScale = fractionalPart.length;
	const priceScaled = amountToScaledAtScale(unitPriceAmount, priceScale);
	const productScaled = quantityScaled * priceScaled;
	const productScale = quantityScale + priceScale;

	return scaledToMoneyString(
		roundHalfUp(productScaled, productScale, minorUnits),
		minorUnits,
	);
}
