import { useState } from "react";
import { SAMPLE_COURSES } from "../client/sample-courses.ts";
import { useExtractorT } from "./useExtractorT.ts";

const LINK_CLASS =
  "sample-link block rounded border border-stone-200 bg-white px-3 py-2 text-sm font-medium hover:border-amber-500 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-950";

/**
 * The sample courses as an optional, closed menu, so that the upload leads the page. A course with several
 * variants is a dropdown plus a Load button: choosing with the keyboard must not start a load on every arrow key.
 */
export default function SampleMenu({ base, load }: { base: string; load: (file: string) => void }) {
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const { t } = useExtractorT();
  return (
    <details data-sample-menu className="mb-3 rounded-lg border border-stone-200 bg-white shadow-sm">
      <summary className="cursor-pointer px-4 py-2 text-sm font-semibold">{t("trySample")}</summary>
      <ul className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {SAMPLE_COURSES.map((course) => {
          const single = course.variants.length === 1 ? course.variants[0] : null;
          if (single?.file) {
            return (
              <li key={course.id}>
                <a href={`${base}samples/${single.file}`} data-sample={single.file} title={single.description} className={LINK_CLASS}
                  onClick={(event) => { event.preventDefault(); load(single.file!); }}>{course.name}</a>
              </li>
            );
          }
          const variant = course.variants.find((candidate) => candidate.id === chosen[course.id]) ??
            course.variants.find((candidate) => candidate.canonical) ?? course.variants[0];
          const selectId = `variant-${course.id}`;
          return (
            <li key={course.id} data-course={course.id}>
              <label htmlFor={selectId} className="block text-sm font-semibold text-stone-800">{course.name}</label>
              <div className="mt-1 flex gap-2">
                <select id={selectId} value={variant.id} className="min-w-0 flex-1 rounded border border-stone-300 bg-white p-2 text-sm"
                  onChange={(event) => setChosen({ ...chosen, [course.id]: event.target.value })}>
                  {course.variants.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
                <button type="button" disabled={!variant.file} data-sample={variant.file ?? undefined}
                  className="rounded bg-stone-900 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600"
                  onClick={() => variant.file && load(variant.file)}>{t("load")}</button>
              </div>
              <p data-variant-description className="mt-1 text-xs text-stone-600">
                {variant.canonical && <strong className="font-semibold">{t("mainVariant")} </strong>}
                {variant.description}
                {!variant.file && <span> {t("gpxToBeAdded")}</span>}
              </p>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
