import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BookOpen, Database, TrendingUp, Layers, Blend, Users, Radio, GitBranch, HelpCircle,
} from 'lucide-react'
import { fetchBacktestReport, fetchStatus, fetchTeams } from '../api'
import { PageHeader } from '../components/ui/PageHeader'
import { SectionCard } from '../components/ui/GlassCard'
import { StatCard } from '../components/ui/StatCard'
import { Collapsible } from '../components/ui/Collapsible'

function Term({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="py-2 border-b border-white/[0.05] last:border-0">
      <div className="font-display text-xs uppercase tracking-[0.12em] text-gold mb-0.5">{term}</div>
      <div className="text-sm text-ink-300 leading-relaxed">{children}</div>
    </div>
  )
}

export function About() {
  const { data: teamsData } = useQuery({ queryKey: ['teams'], queryFn: fetchTeams })
  const { data: status } = useQuery({ queryKey: ['status'], queryFn: fetchStatus, staleTime: 60_000 })
  const { data: report } = useQuery({
    queryKey: ['backtest-report'], queryFn: fetchBacktestReport, staleTime: Infinity,
  })

  return (
    <div className="stagger space-y-5">
      <PageHeader
        title="How It Works"
        icon={BookOpen}
        subtitle="What the model actually does, where the data comes from, and how to read the numbers on every other page."
      />

      {/* Live status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Data through" value={teamsData?.data_through ?? '—'} accent="neutral" />
        <StatCard label="Model trained through" value={teamsData?.model_trained_through ?? '—'} accent="blue" />
        <StatCard
          label="Auto-retrain"
          value={status?.scheduler?.enabled ? 'Active' : 'Off'}
          sub={status?.scheduler?.last_trained_at ? `Last: ${status.scheduler.last_trained_at.slice(0, 10)}` : undefined}
          accent={status?.scheduler?.enabled ? 'green' : 'neutral'}
        />
        <StatCard label="Total teams" value={teamsData?.teams.length ?? 48} accent="gold" />
      </div>

      {/* Data */}
      <SectionCard icon={Database} accent="blue" title="Data">
        <div className="space-y-2.5 text-sm text-ink-300 leading-relaxed">
          <p>
            <span className="text-ink-100 font-semibold">Match history</span> — every men's full
            international since 1872 (~49,000 matches) from the{' '}
            <a href="https://github.com/martj42/international_results" target="_blank" rel="noreferrer"
               className="text-host-blue-bright hover:underline">
              martj42 international results dataset
            </a>, refreshed from GitHub. 2026 World Cup matches are synced live from{' '}
            <a href="https://www.football-data.org/" target="_blank" rel="noreferrer"
               className="text-host-blue-bright hover:underline">football-data.org</a> (and optionally
            API-Football) and merged on top of that CSV baseline, since the community dataset can lag
            by hours.
          </p>
          <p>
            <span className="text-ink-100 font-semibold">Squad data</span> — market value, FIFA
            ranking, share of players at a top-5-league club, average caps, and national-team coach
            win rate for all 48 squads, feeding the post-model squad adjustment below.
          </p>
          <p>
            <span className="text-ink-100 font-semibold">Venue altitude</span> — city-level altitude
            for every 2026 host venue (Mexico City sits at 2,240m); high-altitude matches get a small
            model nudge, since thin air measurably affects goal output.
          </p>
        </div>
      </SectionCard>

      {/* Elo */}
      <SectionCard icon={TrendingUp} accent="gold" title="Elo ratings">
        <p className="text-sm text-ink-300 leading-relaxed">
          Every team's Elo rating is computed from the full match history using the{' '}
          <a href="https://www.eloratings.net/about" target="_blank" rel="noreferrer"
             className="text-host-blue-bright hover:underline">eloratings.net</a> methodology: the
          K-factor (how much a single result moves the rating) scales with match importance — a
          World Cup match moves ratings 3x more than a friendly — and there's an extra multiplier for
          wide goal margins and a home-advantage bonus. Ratings update after <em>every</em> match in
          the dataset, not just World Cup ones, so a team's rating reflects its recent form across all
          competitions.
        </p>
      </SectionCard>

      {/* Model ensemble */}
      <SectionCard icon={Blend} accent="green" title="The prediction model">
        <div className="space-y-2.5 text-sm text-ink-300 leading-relaxed">
          <p>
            Every match/scoreline prediction is a blend of <span className="text-ink-100 font-semibold">four
            independent models</span>: a gradient-boosted classifier (probability-calibrated), a
            regularized multinomial logistic regression, a pair of Poisson goal models (one per side,
            used for the scoreline heatmap), and an Elo-only logistic baseline as a sanity floor. Each
            is trained on 32 features — Elo levels, rolling form over the last 5/10/25{' '}
            <em>competitive</em> matches (friendlies are excluded from form so pre-tournament squad
            rotations don't pollute the signal), days of rest, head-to-head record, match importance,
            neutral-venue flag, venue altitude, and cumulative form within the current World Cup.
          </p>
          <p>
            <span className="text-ink-100 font-semibold">Blend weights are chosen automatically</span>,
            never hand-tuned: a grid search picks the mix that performs best on neutral-venue
            tournament matches after 2014/2018, the result is shrunk halfway toward an equal-parts
            blend as a regularizer against overfitting a small sample, and the 2022 World Cup is held
            out entirely as an honest accuracy check. Recent matches also count more during training —
            an exponential decay with a 3-year half-life weights a match played last year several times
            more heavily than one from a decade ago.
          </p>
        </div>
        {report?.content && (
          <div className="mt-3">
            <Collapsible title="Current backtest report" icon={GitBranch} accent="green">
              <pre className="text-[11px] text-ink-200 whitespace-pre-wrap rounded-lg p-2.5 max-h-80 overflow-y-auto bg-ink-950/60 border border-white/[0.07]">
                {report.content}
              </pre>
            </Collapsible>
          </div>
        )}
      </SectionCard>

      {/* Squad adjustment */}
      <SectionCard icon={Users} accent="blue" title="Squad quality adjustment">
        <p className="text-sm text-ink-300 leading-relaxed">
          After the four-model blend, probabilities get a small logit-scale nudge from a composite
          squad-quality score: market value (35%), FIFA ranking (25%), share of players at a top-5
          European league club (20%), average international caps (10%), and coach win rate (10%). This
          is what lets the model react to a season's transfer activity or a coaching change that Elo
          alone — which only sees match results — wouldn't pick up yet. The strength of this
          adjustment is a slider in the sidebar (default 0.18); setting it to 0 disables it entirely
          and predictions fall back to the pure blended model. Marking key players as injured in the
          sidebar reduces a team's effective squad value before this score is computed.
        </p>
      </SectionCard>

      {/* Live + knockout */}
      <SectionCard icon={Radio} accent="red" title="Live win probability & knockout ties">
        <div className="space-y-2.5 text-sm text-ink-300 leading-relaxed">
          <p>
            During a live match, the pre-match expected goals for each side are scaled down by the
            fraction of time remaining — at minute 60 of 90, each team has 33% of its expected goals
            left to score — and the full Poisson distribution of additional goals is summed over every
            combination that would produce a home win, draw, or away win from the current score.
          </p>
          <p>
            For knockout matches (and the tournament simulation below), a draw after 90 minutes doesn't
            stay a draw — it goes to extra time and penalties. The model resolves this by leaning the
            draw probability toward whichever side had the stronger edge in normal time, but shrunk
            most of the way toward a coin flip, since extra time and a shootout are closer to random
            than 90 minutes of open play.
          </p>
        </div>
      </SectionCard>

      {/* Simulation */}
      <SectionCard icon={Layers} accent="gold" title="Tournament simulation">
        <p className="text-sm text-ink-300 leading-relaxed">
          The Simulator runs the entire remaining bracket 2,000–20,000 times using the same
          match-level model above: for each simulated group stage, scorelines are sampled from the
          predicted score distribution; group rankings apply the FIFA 2026 tiebreaker order (points →
          goal difference → goals for → head-to-head → wins); the eight best third-place teams are
          assigned to their constrained Round-of-32 slots exactly as FIFA's format requires; and every
          knockout match onward uses the extra-time-adjusted win probability above. Real, already-played
          results are locked into every single simulation — only genuinely undecided matches are
          random — and championship odds are just how often each team wins across every run.
        </p>
      </SectionCard>

      {/* Glossary */}
      <SectionCard icon={HelpCircle} accent="neutral" title="Reading the numbers">
        <Term term="Elo">
          A relative-strength rating updated after every match a team plays (not just World Cup ones).
          Roughly: a 200-point Elo gap corresponds to about a 75% win probability between two evenly
          matched sides at a neutral venue.
        </Term>
        <Term term="Expected goals (xG / λ)">
          The model's predicted average goals for a side in this specific matchup — the mean of the
          Poisson distribution used to build the scoreline heatmap. A team can be "expected" 1.8 goals
          and still score 0 or 4; it's an average across many hypothetical replays, not a forecast of
          the exact score.
        </Term>
        <Term term="Brier score">
          The average squared error between a predicted probability and the actual outcome (0 or 1),
          summed across win/draw/loss. Lower is better; 0 is a perfect prediction, 0.667 is what
          picking randomly gets you, and this model typically lands well below that on held-out World
          Cups (see the backtest report above).
        </Term>
        <Term term="Squad strength">
          The sidebar slider controlling how much the squad-quality adjustment (above) can move a
          prediction away from the pure model blend. Higher values let market value / FIFA rank /
          coaching factor in more; 0 disables the adjustment.
        </Term>
        <Term term="Locked results">
          Real, already-played match results that are fixed as-is in every simulation run, rather than
          being re-predicted. The Scenario Builder lets you additionally lock in hypothetical results
          for matches that haven't been played yet, to see how the bracket would react.
        </Term>
      </SectionCard>
    </div>
  )
}
