export type SimilarCandidate = {
  id: string;
  title: string;
  author: string;
  genre: string | null;
  rating: number | null;
  pages: number | null;
  publicationYear: number | null;
  subjects: string[];
};

export type SimilarityResult = { score: number; reasons: string[] };

export function scoreSimilarity(seed: SimilarCandidate, candidate: SimilarCandidate): SimilarityResult {
  if (seed.id === candidate.id) return { score: 0, reasons: [] };

  let score = 0;
  const reasons: string[] = [];

  if (seed.author === candidate.author) {
    score += 5;
    reasons.push("same author");
  }
  if (seed.genre && seed.genre === candidate.genre) {
    score += 3;
    reasons.push("same genre");
  }

  const shared = seed.subjects.filter((s) => candidate.subjects.includes(s));
  if (shared.length > 0) {
    const capped = Math.min(4, shared.length);
    score += capped;
    reasons.push(`shared subjects: ${shared.slice(0, 3).join(", ")}`);
  }

  if (seed.pages && candidate.pages) {
    const ratio = candidate.pages / seed.pages;
    if (ratio >= 0.7 && ratio <= 1.3) {
      score += 1;
      reasons.push("similar length");
    }
  }

  if (seed.publicationYear && candidate.publicationYear) {
    if (Math.abs(seed.publicationYear - candidate.publicationYear) <= 10) {
      score += 0.5;
      reasons.push("similar era");
    }
  }

  if (seed.rating && candidate.rating && Math.abs(seed.rating - candidate.rating) <= 1) {
    score += 1;
    reasons.push("similar rating");
  }

  return { score, reasons };
}

export function rankSimilar(
  seed: SimilarCandidate,
  candidates: readonly SimilarCandidate[],
  limit = 5,
): (SimilarCandidate & { score: number; reasons: string[] })[] {
  return candidates
    .map((candidate) => {
      const { score, reasons } = scoreSimilarity(seed, candidate);
      return { ...candidate, score, reasons };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit);
}