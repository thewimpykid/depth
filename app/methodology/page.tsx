import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "methodology – depth",
  description: "How depth's predictions and simulations work.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[12px] border border-white/10 bg-[#090909] p-6">
      <h2 className="mb-4 text-lg font-medium tracking-[-0.03em] text-white">{title}</h2>
      {children}
    </section>
  );
}

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-3 rounded-[8px] border border-white/8 bg-[#0d0d0d] px-4 py-3 font-mono text-sm text-white/80">
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs text-white/50">{children}</span>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed text-white/62">{children}</p>;
}

function Caveat({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-[8px] border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 text-sm leading-relaxed text-yellow-200/60">
      {children}
    </div>
  );
}

function Dl({ items }: { items: { term: string; def: string }[] }) {
  return (
    <dl className="mt-3 space-y-2">
      {items.map(({ term, def }) => (
        <div key={term} className="flex gap-3 text-sm">
          <dt className="w-44 shrink-0 font-mono text-xs text-white/42 pt-[1px]">{term}</dt>
          <dd className="text-white/62 leading-relaxed">{def}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function MethodologyPage() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-medium tracking-[-0.04em] text-white">Methodology</h1>
        <p className="mt-2 text-sm text-white/42">
          How predictions and simulations are calculated. OPR is standard and well-documented elsewhere — this covers everything built on top of it.
        </p>
      </div>

      <div className="flex flex-col gap-5">
        {/* OPR solver */}
        <Section title="OPR Computation">
          <P>
            OPR (Offensive Power Rating) is a least-squares estimate of each team&apos;s individual
            contribution to their alliance score. Given a set of matches, it solves the system{" "}
            <span className="font-mono text-white/80">AᵀAx = Aᵀb</span> where each row of{" "}
            <span className="font-mono text-white/80">A</span> indicates which teams played in that
            match, and <span className="font-mono text-white/80">b</span> is the alliance scores.
          </P>
          <Formula>
            <span className="text-white/42">{"// normal equations"}</span><br />
            AᵀA · x = Aᵀb<br />
            <Label>solved via Gauss-Jordan elimination with partial pivoting</Label>
          </Formula>
          <P>
            All strength modes below use this solver on per-event match data pulled from the FTC API
            hybrid schedule. Scores are Non-Penalty only — foul points are excluded from{" "}
            <span className="font-mono text-white/80">b</span>.
          </P>
        </Section>

        {/* Team Strength */}
        <Section title="Team Strength — Three Modes">
          <P>
            There are three ways the simulator can determine each team&apos;s strength. Switch between
            them using the <strong className="text-white/80">Season Best</strong> /{" "}
            <strong className="text-white/80">Pre-Event</strong> /{" "}
            <strong className="text-white/80">Post-Event</strong> toggle on the simulate page.
          </P>

          <div className="mt-4 space-y-4">
            <div>
              <div className="mb-1 text-sm font-medium text-white/80">Season Best (default)</div>
              <P>
                Fetches all events the team played in this season, computes OPR at each event
                individually, and returns the highest value. Teams with no season matches fall back
                to the event mean.
              </P>
              <Formula>
                strength = max(OPR(event) for each event the team played this season)<br />
                <Label>OPR computed independently per event from that event&apos;s match data</Label>
              </Formula>
              <Caveat>
                <strong className="text-yellow-200/80">Future data contamination.</strong>{" "}
                Season best includes events that happen <em>after</em> the one being simulated. A team
                that peaked in December will appear inflated in an October simulation. Switch to{" "}
                <strong className="text-yellow-200/70">Pre-Event</strong> to eliminate this.
              </Caveat>
            </div>

            <div>
              <div className="mb-1 text-sm font-medium text-white/80">Pre-Event</div>
              <P>
                For each team, finds their most recent event that <em>ended before</em> the simulated
                event&apos;s start date, computes OPR at that event, and uses that as strength.
                Teams with no qualifying prior events fall back to the event mean.
              </P>
              <Formula>
                strength = OPR at the team&apos;s most recent prior event<br />
                <Label>only events ending before this event&apos;s start date</Label>
              </Formula>
              <P>
                This is the most historically accurate mode. Teams playing their first event of the
                season get a <span className="font-mono text-white/80">No prior data</span> badge and
                fall back to the event mean.
              </P>
            </div>

            <div>
              <div className="mb-1 text-sm font-medium text-white/80">Post-Event</div>
              <P>
                Computes OPR using this event&apos;s own match results. Only valid after the event has
                played matches — before that, all teams have null strength and fall back to the mean.
                Useful for reviewing how a completed event played out relative to the actual performance
                levels observed there.
              </P>
              <Formula>
                strength = OPR(this event&apos;s matches)
              </Formula>
            </div>
          </div>

          <Dl
            items={[
              { term: "fallback strength", def: "Mean of all known strengths at the event, or 80 if none are available. Used for teams with null strength in any mode." },
            ]}
          />
        </Section>

        {/* First event */}
        <Section title="First-Event & Early-Season Predictions">
          <P>
            All modes have reliability limits when teams have little data.
          </P>
          <Dl
            items={[
              {
                term: "Season best, first event",
                def: "Team has no season matches yet. Strength is null → falls back to event mean. They appear average regardless of actual quality.",
              },
              {
                term: "Pre-event, first event",
                def: "No prior events ended before this one. Same result: strength null → event fallback. Shown with a 'No prior data' badge in the standings.",
              },
              {
                term: "Post-event, no matches",
                def: "If the event hasn't played any matches yet, all OPRs are zero or null and every team falls back to the mean.",
              },
              {
                term: "Few prior matches",
                def: "OPR from only 1–2 events (small n) can be noisy. A team that consistently played with strong partners may appear inflated. Treat early-season estimates as rough.",
              },
              {
                term: "Live event",
                def: "Post-event mode updates as matches are played at the ongoing event. Pre-event ignores those results entirely. For live predictions, post-event mode is generally more useful once several matches have been played.",
              },
            ]}
          />
          <Caveat>
            At a team&apos;s first event of the season there is no reliable signal regardless of mode.
            Strong rookies and weaker returning teams look identical. Widen your confidence interval significantly
            for any team tagged <span className="text-yellow-300/70">No prior data</span>.
          </Caveat>
        </Section>

        {/* Match Score Prediction */}
        <Section title="Match Score Prediction">
          <P>
            The predicted score for an alliance is the sum of its two teams&apos; NP OPRs. Win probability
            is derived from the score gap using a logistic (sigmoid) function.
          </P>
          <Formula>
            predictedRed = NP_OPR(red₁) + NP_OPR(red₂)<br />
            predictedBlue = NP_OPR(blue₁) + NP_OPR(blue₂)
          </Formula>
          <Formula>
            P(red wins) = 1 / (1 + exp(−(predictedRed − predictedBlue) / scale))<br />
            <Label>scale = max(14, fallbackStrength × 0.28)</Label>
          </Formula>
          <P>
            The scale parameter controls how sensitive win probability is to score differences.
            A larger scale makes the function flatter — small gaps matter less.
            It grows with the typical scoring level at the event so the sensitivity stays proportional
            regardless of the season&apos;s game design.
          </P>
        </Section>

        {/* Score Sampling */}
        <Section title="Score Sampling (Monte Carlo Runs)">
          <P>
            Each simulation run samples actual match scores from a normal distribution centered on the
            predicted score. This reflects the real-world variance in team performance.
          </P>
          <Formula>
            sampledScore = max(0, Gaussian(predictedScore, σ))<br />
            <Label>σ = max(8, fallbackStrength × 0.16)</Label>
          </Formula>
          <P>
            The standard deviation σ scales with the event&apos;s scoring level.
            Higher-scoring events have proportionally more variance. The minimum of 8 prevents
            near-zero spread at very low-scoring events.
            Scores are clamped to zero — no negative match scores.
          </P>
          <P>
            The Gaussian sampler uses the Box-Muller transform to convert two uniform random values
            into a normally distributed sample:
          </P>
          <Formula>
            u = 2·r₁ − 1, v = 2·r₂ − 1, s = u² + v²<br />
            sample = mean + u · √(−2·ln(s) / s) · σ
          </Formula>
        </Section>

        {/* RNG */}
        <Section title="Random Number Generation">
          <P>
            All randomness uses a seeded, deterministic RNG so the same inputs always produce
            the same results. The seed is derived from the event code and season using FNV-1a hashing,
            then fed into a PCG generator.
          </P>
          <Formula>
            <span className="text-white/42">{"// FNV-1a hash (seed text → integer)"}</span><br />
            hash = 2166136261<br />
            for each char: hash ^= charCode; hash = (hash × 16777619) mod 2³²<br />
            <br />
            <span className="text-white/42">{"// PCG step (integer → [0, 1))"}</span><br />
            state += 0x6d2b79f5<br />
            word = ((state &gt;&gt; 22) ^ state) &gt;&gt; (state &gt;&gt; 28) + 22<br />
            return (word ^ (word &lt;&lt; 2)) / 2³²
          </Formula>
          <P>
            Using a deterministic RNG means two users running the same simulation see identical results.
            The seed changes between simulation runs so each run is independent.
          </P>
        </Section>

        {/* Schedule Modes */}
        <Section title="Schedule Modes">
          <P>
            There are two ways to generate the qualification schedule used in simulation:
          </P>
          <Dl
            items={[
              {
                term: "API Schedule",
                def: "Uses the official FTC API's published match schedule. Teams, alliances, and match order are exactly what was set for the real event.",
              },
              {
                term: "Random Schedule",
                def: "Generates a schedule from scratch using the event's team roster. Each round shuffles teams with Fisher-Yates and groups them into 2v2 alliances. This is useful for events without a published schedule or for exploring counterfactuals.",
              },
            ]}
          />
          <Formula>
            <span className="text-white/42">{"// Fisher-Yates shuffle (per round)"}</span><br />
            for i from n−1 down to 1:<br />
            {"  "}j = floor(rng() × (i + 1))<br />
            {"  "}swap(teams[i], teams[j])
          </Formula>
          <P>
            The random scheduler also attempts to balance alliances by minimizing a penalty score
            that accounts for past partner/opponent repetition and red/blue strength imbalance:
          </P>
          <Formula>
            penalty = partnerRepeat × 4 + opponentRepeat × 1.5 + |redStrength − blueStrength| × 0.08
          </Formula>
        </Section>

        {/* Qual standings */}
        <Section title="Qualification Standings">
          <P>
            After each simulation run, teams are ranked by the standard FTC tiebreaker rules:
          </P>
          <Dl
            items={[
              { term: "1st", def: "Wins (descending)" },
              { term: "2nd", def: "Tiebreaker score — sum of the losing alliance's score in every match the team played (descending)" },
              { term: "3rd", def: "Team number (ascending)" },
            ]}
          />
          <P>
            Tiebreaker score is computed within each run using the sampled (random) scores, not the
            predicted means — so it varies across runs and is probabilistic.
          </P>
        </Section>

        {/* Playoffs */}
        <Section title="Playoff Simulation">
          <P>
            After qualification, the top 4 seeds form alliances and play a seeded single-elimination
            bracket with best-of-3 series.
          </P>
          <Dl
            items={[
              {
                term: "Alliance selection",
                def: "Seeds 1–4 each pick one partner. Selection is greedy: each captain picks the highest-NP-OPR available team that hasn't already been picked.",
              },
              {
                term: "Bracket",
                def: "Semifinal 1: Seed 1 vs Seed 4. Semifinal 2: Seed 2 vs Seed 3. Finals: semi winners.",
              },
              {
                term: "Series format",
                def: "Best-of-3 — first alliance to win 2 matches advances. Each game uses the same Gaussian score sampling as qualification.",
              },
            ]}
          />
        </Section>

        {/* Output stats */}
        <Section title="Output Statistics">
          <P>
            All metrics are aggregated across N simulation runs (default 300, configurable 50–2000).
            Higher run counts reduce variance in the estimates.
          </P>
          <Dl
            items={[
              { term: "Expected Wins", def: "Mean wins across all runs." },
              { term: "Average Seed", def: "Mean qual ranking across all runs." },
              { term: "1st Seed %", def: "Fraction of runs where the team finished 1st in quals." },
              { term: "Top 4 %", def: "Fraction of runs where the team was in the top 4 seeds (alliance captain eligible)." },
              { term: "Semifinal %", def: "Fraction of runs where the team reached the semifinals (as any alliance member)." },
              { term: "Finalist %", def: "Fraction of runs where the team reached the finals." },
              { term: "Champion %", def: "Fraction of runs where the team won the event." },
              { term: "Avg Score For", def: "Mean sampled alliance score across all qualification matches in all runs." },
            ]}
          />
          <P>
            Probabilities are empirical frequencies — no closed-form formula, just counting outcomes
            over many runs. More simulations → more stable numbers.
          </P>
        </Section>

        {/* Known limitations */}
        <Section title="Known Limitations">
          <Dl
            items={[
              {
                term: "Future data (season best)",
                def: "Default mode uses the team's best per-event OPR across the full season. Past-event simulations may reflect a team's later performance. Switch to Pre-Event to eliminate this.",
              },
              {
                term: "Small-event OPR noise",
                def: "OPR solved from only a few matches (e.g., a single 6-team event) is noisy and may not generalize. The normal equations become ill-conditioned when team co-appearances are sparse.",
              },
              {
                term: "First-event teams",
                def: "Teams with no prior season matches are indistinguishable from an average team in both modes. Shown with a 'No prior data' badge in pre-event mode.",
              },
              {
                term: "Alliance scoring model",
                def: "Predicted alliance score = sum of two team strengths. Assumes additive, independent contributions — synergies and role specialization aren't captured.",
              },
              {
                term: "Variance model",
                def: "Score variance is a fixed proportion of the event's scoring level, not fit per team. Some teams are more consistent or volatile than the model assumes.",
              },
            ]}
          />
        </Section>

        {/* Data sources */}
        <Section title="Data Sources">
          <Dl
            items={[
              { term: "FTC API", def: "Official FIRST Tech Challenge API. Provides event rosters, published schedules, and match results." },
              { term: "FTCScout", def: "Community stats site. Provides NP OPR (tot) and component quick stats used as team strength." },
            ]}
          />
        </Section>
      </div>
    </main>
  );
}
