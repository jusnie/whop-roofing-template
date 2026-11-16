import { COMPANY_CONFIG } from "../config/company.config";

export function ReviewsTrustSection() {
  const { reviews, certifications } = COMPANY_CONFIG;
  const [leadReview, ...otherReviews] = reviews.items;

  return (
    <section
      id="reviews"
      className="py-20 lg:py-28 bg-[var(--surface-page)] border-b border-[var(--border-hairline)]"
    >
      <div className="mx-auto max-w-[1360px] px-6 lg:px-8">
        <div className="max-w-[620px]">
          <p className="font-mono text-[12px] leading-4 text-[var(--text-muted)]">
            06 · Credentials and recent roofs
          </p>
          <h2 className="mt-3 font-display text-[36px] sm:text-[44px] leading-[1.08] text-[var(--text-primary)]">
            Manufacturer certifications and homeowner feedback
          </h2>
        </div>

        {/* Four manufacturer & licensing credentials — hairline separated, no decorative icon boxes */}
        <dl className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-y border-[var(--border-hairline)] divide-y sm:divide-y-0 sm:divide-x divide-[var(--border-hairline)]">
          {certifications.map((cert, idx) => (
            <div
              key={cert.title}
              className={`py-6 ${idx > 0 ? "lg:pl-6" : ""} ${idx < 3 ? "lg:pr-6" : ""} ${
                idx % 2 === 1 ? "sm:pl-6" : "sm:pr-6"
              }`}
            >
              <dt className="font-mono text-[12px] leading-4 text-[var(--text-muted)]">
                {cert.issuer}
              </dt>
              <dd className="mt-2 text-[15px] leading-5 font-medium text-[var(--text-primary)]">
                {cert.title}
              </dd>
              <dd className="mt-1 text-[13px] leading-5 text-[var(--text-secondary)]">
                {cert.detail}
              </dd>
            </div>
          ))}
        </dl>

        {/* Varied-width customer projects: one wide featured project + two stacked cards */}
        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-12 items-stretch">
          <figure className="lg:col-span-7 flex flex-col justify-between rounded-[16px] border border-[var(--border-hairline)] bg-[var(--surface-card)] p-6 lg:p-8 shadow-subtle">
            <div>
              <div className="flex items-baseline justify-between gap-4 font-mono text-[12px] leading-4 text-[var(--text-muted)]">
                <span>{leadReview.projectType}</span>
                <span>{leadReview.date}</span>
              </div>
              <blockquote className="mt-6 text-[18px] sm:text-[20px] leading-[30px] font-normal text-[var(--text-primary)]">
                “{leadReview.quote}”
              </blockquote>
            </div>

            <figcaption className="mt-8 pt-6 border-t border-[var(--border-hairline)] flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[15px] leading-5 font-medium text-[var(--text-primary)]">
                  {leadReview.author}
                </p>
                <p className="mt-1 text-[13px] leading-5 text-[var(--text-muted)]">
                  {leadReview.neighborhood} · {leadReview.cityState}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[18px] leading-6 font-medium text-[var(--text-primary)] tabular-nums">
                  {leadReview.projectAmount}
                </p>
                <p className="mt-1 font-mono text-[12px] leading-4 text-[var(--text-muted)]">
                  {leadReview.paidVia}
                </p>
              </div>
            </figcaption>
          </figure>

          <div className="lg:col-span-5 flex flex-col gap-6">
            {otherReviews.map((review) => (
              <figure
                key={review.id}
                className="flex flex-1 flex-col justify-between rounded-[16px] border border-[var(--border-hairline)] bg-[var(--surface-card)] p-6 shadow-subtle"
              >
                <div>
                  <div className="flex items-baseline justify-between gap-4 font-mono text-[12px] leading-4 text-[var(--text-muted)]">
                    <span className="truncate">{review.projectType}</span>
                    <span className="shrink-0">{review.date}</span>
                  </div>
                  <blockquote className="mt-4 text-[15px] leading-[24px] text-[var(--text-secondary)]">
                    “{review.quote}”
                  </blockquote>
                </div>

                <figcaption className="mt-6 pt-4 border-t border-[var(--border-hairline)] flex items-baseline justify-between gap-4">
                  <div>
                    <p className="text-[14px] leading-5 font-medium text-[var(--text-primary)]">
                      {review.author}
                    </p>
                    <p className="text-[12px] leading-4 text-[var(--text-muted)] mt-1">
                      {review.neighborhood}, {review.cityState}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-[15px] leading-5 font-medium text-[var(--text-primary)] tabular-nums">
                      {review.projectAmount}
                    </p>
                    <p className="font-mono text-[11px] leading-4 text-[var(--text-muted)] mt-1">
                      {review.paidVia}
                    </p>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
