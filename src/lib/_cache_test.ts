import { unstable_cache, cacheLife } from "next/cache";

function cachePerUser<T extends unknown[], R>(
  name: string,
  fn: (...args: T) => Promise<R>,
): (...args: T) => Promise<R> {
  return unstable_cache(
    async (...args: T) => {
      cacheLife("hours");
      return fn(...args);
    },
    [name],
    { tags: ["stats"] },
  );
}

const getYearlyTrendCached = cachePerUser("getYearlyTrend", async (userId: string) => {
  return [{ readingYear: 2024 }];
});

export async function getYearlyTrend(): Promise<Array<{ readingYear: number }>> {
  return getYearlyTrendCached("marino");
}