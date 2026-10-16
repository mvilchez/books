export function normalizeTagName(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function editSimilarity(left: string, right: string): number {
  if (left === right) return 1;
  if (!left || !right) return 0;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex++) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex++) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] +
          Number(left[leftIndex - 1] !== right[rightIndex - 1]),
      );
    }
    previous = current;
  }
  return 1 - previous[right.length] / Math.max(left.length, right.length);
}

export function tagSimilarity(left: string, right: string): number {
  const normalizedLeft = normalizeTagName(left);
  const normalizedRight = normalizeTagName(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;

  const leftTokens = normalizedLeft.split(" ");
  const rightTokens = normalizedRight.split(" ");
  if (
    leftTokens.length === rightTokens.length &&
    [...leftTokens].sort().join(" ") === [...rightTokens].sort().join(" ")
  ) {
    return 0.98;
  }

  const tokenSimilarity =
    leftTokens.length === rightTokens.length
      ? leftTokens.reduce((score, token, index) => {
          const other = rightTokens[index] ?? "";
          return score + editSimilarity(token, other);
        }, 0) / leftTokens.length
      : 0;
  return Math.max(
    editSimilarity(normalizedLeft, normalizedRight),
    tokenSimilarity,
  );
}

export type SimilarTagSuggestion<T extends { name: string }> = {
  tag: T;
  similarity: number;
};

export function findSimilarTags<T extends { name: string }>(
  name: string,
  tags: readonly T[],
  threshold = 0.78,
): SimilarTagSuggestion<T>[] {
  const normalized = normalizeTagName(name);
  if (!normalized) return [];
  return tags
    .map((tag) => {
      const existingName = normalizeTagName(tag.name);
      const queryTokens = normalized.split(" ");
      const finalQueryToken = queryTokens.at(-1) ?? "";
      const isPrefix =
        existingName.startsWith(normalized) ||
        existingName
          .split(" ")
          .some((token) => token.startsWith(finalQueryToken));
      return {
        tag,
        similarity: tagSimilarity(name, tag.name),
        isExact: existingName === normalized,
        isPrefix,
      };
    })
    .filter(
      ({ similarity, isExact, isPrefix }) =>
        isExact || isPrefix || similarity >= threshold,
    )
    .sort(
      (left, right) =>
        Number(right.isExact) - Number(left.isExact) ||
        Number(right.isPrefix) - Number(left.isPrefix) ||
        right.similarity - left.similarity ||
        left.tag.name.localeCompare(right.tag.name),
    )
    .slice(0, 8)
    .map(({ tag, similarity }) => ({ tag, similarity }));
}

export type SimilarTagPair<T extends { id: string; name: string }> = {
  first: T;
  second: T;
  similarity: number;
};

export function findSimilarTagPairs<T extends { id: string; name: string }>(
  tags: readonly T[],
  threshold = 0.82,
): SimilarTagPair<T>[] {
  const pairs: SimilarTagPair<T>[] = [];
  const normalizedTags = tags
    .map((tag) => ({ tag, normalized: normalizeTagName(tag.name) }))
    .filter(({ normalized }) => normalized.length >= 5);

  for (let leftIndex = 0; leftIndex < normalizedTags.length; leftIndex++) {
    const left = normalizedTags[leftIndex];
    if (!left) continue;
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < normalizedTags.length;
      rightIndex++
    ) {
      const right = normalizedTags[rightIndex];
      if (!right) continue;
      if (left.normalized === right.normalized) continue;
      if (Math.abs(left.normalized.length - right.normalized.length) > 3) continue;
      const sameWordSet =
        [...left.normalized.split(" ")].sort().join(" ") ===
        [...right.normalized.split(" ")].sort().join(" ");
      const firstCharacterTypo =
        left.normalized.length >= 8 &&
        right.normalized.length >= 8 &&
        editSimilarity(left.normalized.slice(1), right.normalized.slice(1)) >=
          threshold;
      if (
        !sameWordSet &&
        left.normalized[0] !== right.normalized[0] &&
        !firstCharacterTypo
      ) {
        continue;
      }
      const similarity = tagSimilarity(left.tag.name, right.tag.name);
      if (similarity >= threshold) {
        pairs.push({ first: left.tag, second: right.tag, similarity });
      }
    }
  }
  return pairs.sort(
    (left, right) =>
      right.similarity - left.similarity ||
      left.first.name.localeCompare(right.first.name),
  );
}
