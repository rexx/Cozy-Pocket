import React, { useEffect, useMemo, useState } from 'react';
import { CATEGORIES, formatCurrencyAmount } from '../../constants';
import { Transaction, TransactionType } from '../../types';
import { MonthlyTrendBucket, getMonthlyTrend } from '../../services/statsService';

interface MonthlyTrendChartProps {
  transactions: Transaction[];
  currency: string;
  endDate: Date;
  monthCount: number;
}

const CATEGORY_BY_ID = new Map(CATEGORIES.map((category) => [category.id, category]));
const UNKNOWN_CATEGORY_COLOR = '#64748b';

const getCategoryName = (categoryId: string) => (
  CATEGORY_BY_ID.get(categoryId)?.name || '未分類'
);

const getCategoryColor = (categoryId: string) => (
  CATEGORY_BY_ID.get(categoryId)?.color || UNKNOWN_CATEGORY_COLOR
);

// Viewport-independent drawing space. The SVG scales through viewBox alone, so
// nothing here depends on measuring the container at runtime.
const VIEW_WIDTH = 360;
const VIEW_HEIGHT = 208;
const PAD_LEFT = 40;
const PAD_RIGHT = 6;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;
const PLOT_WIDTH = VIEW_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = VIEW_HEIGHT - PAD_TOP - PAD_BOTTOM;
const AXIS_TICKS = 4;
const MAX_READOUT_ROWS = 5;

const formatCompactAmount = (value: number) => {
  if (value === 0) return '0';
  if (value >= 10000) {
    const inTenThousands = value / 10000;
    const rounded = inTenThousands >= 10
      ? Math.round(inTenThousands).toString()
      : inTenThousands.toFixed(1).replace(/\.0$/, '');
    return `${rounded}萬`;
  }
  return Math.round(value).toLocaleString();
};

// Round the axis top up to a 1 / 2 / 2.5 / 5 x 10^n step so the gridlines land
// on numbers a reader can hold in their head. Scaling the raw maximum by a flat
// headroom factor instead produces labels like "4,393", which cost more to read
// than the bar they annotate.
const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10];

const getNiceAxisMax = (rawMax: number, tickCount: number) => {
  if (rawMax <= 0) return tickCount;
  const roughStep = rawMax / tickCount;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  const niceStep = NICE_STEPS.find((step) => normalized <= step) ?? 10;
  return niceStep * magnitude * tickCount;
};

// One unit for the whole axis. Mixing "5,000" and "1萬" on neighbouring
// gridlines makes the reader re-scale between ticks.
const buildAxisFormatter = (axisMax: number) => (
  axisMax >= 10000
    ? (value: number) => (value === 0 ? '0' : `${Number((value / 10000).toFixed(1))}萬`)
    : (value: number) => Math.round(value).toLocaleString()
);

const MonthlyTrendChart: React.FC<MonthlyTrendChartProps> = ({
  transactions,
  currency,
  endDate,
  monthCount,
}) => {
  const [trendType, setTrendType] = useState<TransactionType>('支出');
  const [hiddenCategoryIds, setHiddenCategoryIds] = useState<string[]>([]);
  const [focusIndex, setFocusIndex] = useState(monthCount - 1);

  const buckets = useMemo(
    () => getMonthlyTrend(transactions, { endDate, monthCount, currency, type: trendType }),
    [transactions, endDate, monthCount, currency, trendType]
  );

  // Category totals across the whole window drive both the stack order and the
  // chip order, so a colour band keeps the same slot in every bar. Re-sorting
  // per month would make a band jump up and down between neighbouring bars,
  // which is the one thing a stacked chart cannot survive.
  const orderedCategoryIds = useMemo(() => {
    const totals = new Map<string, number>();
    buckets.forEach((bucket) => {
      bucket.categories.forEach((point) => {
        totals.set(point.categoryId, (totals.get(point.categoryId) || 0) + point.total);
      });
    });
    return Array.from(totals.entries())
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]);
      })
      .map(([categoryId]) => categoryId);
  }, [buckets]);

  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>();
    buckets.forEach((bucket) => {
      bucket.categories.forEach((point) => {
        totals.set(point.categoryId, (totals.get(point.categoryId) || 0) + point.total);
      });
    });
    return totals;
  }, [buckets]);

  // Hiding survives month navigation but not a type switch, because the income
  // and expense category sets do not overlap.
  useEffect(() => {
    setHiddenCategoryIds([]);
  }, [trendType, currency]);

  useEffect(() => {
    setFocusIndex(monthCount - 1);
  }, [endDate, monthCount, trendType, currency]);

  const hiddenSet = useMemo(() => new Set(hiddenCategoryIds), [hiddenCategoryIds]);
  const visibleCategoryIds = useMemo(
    () => orderedCategoryIds.filter((categoryId) => !hiddenSet.has(categoryId)),
    [orderedCategoryIds, hiddenSet]
  );

  const visibleTotals = useMemo(
    () => buckets.map((bucket) => (
      bucket.categories.reduce(
        (sum, point) => (hiddenSet.has(point.categoryId) ? sum : sum + point.total),
        0
      )
    )),
    [buckets, hiddenSet]
  );

  const isIncome = trendType === '收入';
  const accentTextClassName = isIncome ? 'text-rose-300' : 'text-emerald-300';
  const hasAnyData = orderedCategoryIds.length > 0;
  const hasVisibleData = visibleTotals.some((total) => total > 0);

  const axisMax = getNiceAxisMax(Math.max(0, ...visibleTotals), AXIS_TICKS);
  const formatAxisAmount = buildAxisFormatter(axisMax);
  const columnWidth = PLOT_WIDTH / Math.max(1, buckets.length);
  const barWidth = Math.min(20, columnWidth * 0.62);

  const averageTotal = visibleTotals.length > 0
    ? visibleTotals.reduce((sum, value) => sum + value, 0) / visibleTotals.length
    : 0;
  const peakIndex = visibleTotals.reduce(
    (best, value, index) => (value > visibleTotals[best] ? index : best),
    0
  );
  const previousTotal = visibleTotals[visibleTotals.length - 2] ?? 0;
  const latestTotal = visibleTotals[visibleTotals.length - 1] ?? 0;
  const monthOverMonth = previousTotal > 0
    ? ((latestTotal - previousTotal) / previousTotal) * 100
    : null;

  const safeFocusIndex = Math.min(Math.max(focusIndex, 0), Math.max(0, buckets.length - 1));
  const focusBucket: MonthlyTrendBucket | undefined = buckets[safeFocusIndex];
  const focusPoints = (focusBucket?.categories || [])
    .filter((point) => !hiddenSet.has(point.categoryId) && point.total > 0);
  const focusTotal = visibleTotals[safeFocusIndex] ?? 0;
  const focusVisibleRows = focusPoints.slice(0, MAX_READOUT_ROWS);
  const focusRestRows = focusPoints.slice(MAX_READOUT_ROWS);
  const focusRestTotal = focusRestRows.reduce((sum, point) => sum + point.total, 0);

  const formatAmount = (value: number) => formatCurrencyAmount(value, currency, { withSpace: true });

  const toggleCategory = (categoryId: string) => {
    setHiddenCategoryIds((prev) => (
      prev.includes(categoryId)
        ? prev.filter((item) => item !== categoryId)
        : [...prev, categoryId]
    ));
  };

  const peakBucket = hasVisibleData ? buckets[peakIndex] : undefined;
  const previousBucket = buckets[buckets.length - 2];

  // Three tiles across an iPhone-width card leave roughly 74px of text each, so
  // the amounts use the same compact unit as the axis and the month moves to
  // its own caption line. A single line carrying both would truncate.
  const summaryTiles = [
    {
      label: '月均',
      value: formatCompactAmount(Math.round(averageTotal)),
      caption: `${monthCount} 個月`,
      valueClassName: 'text-gray-200',
    },
    {
      label: '最高月',
      value: peakBucket ? formatCompactAmount(visibleTotals[peakIndex]) : '—',
      caption: peakBucket ? `${peakBucket.month + 1} 月` : '沒有資料',
      valueClassName: 'text-gray-200',
    },
    {
      label: '較上月',
      value: monthOverMonth === null
        ? '—'
        : `${monthOverMonth > 0 ? '+' : ''}${monthOverMonth.toFixed(0)}%`,
      caption: previousBucket ? `對比 ${previousBucket.month + 1} 月` : '沒有前一月',
      valueClassName: monthOverMonth === null
        ? 'text-gray-500'
        : monthOverMonth > 0 ? 'text-rose-300' : 'text-emerald-300',
    },
  ];

  const allCategoriesVisible = visibleCategoryIds.length === orderedCategoryIds.length;
  const allCategoriesHidden = visibleCategoryIds.length === 0;
  const bulkSelectButtonClassName = 'shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black text-gray-300 transition-all hover:text-white active:scale-95';

  const yForValue = (value: number) => PAD_TOP + PLOT_HEIGHT - (value / axisMax) * PLOT_HEIGHT;

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-[#1f2334]/80 p-1">
        {(['支出', '收入'] as TransactionType[]).map((option) => {
          const isActive = trendType === option;
          const activeClassName = option === '收入'
            ? 'bg-rose-500/15 text-rose-300'
            : 'bg-emerald-500/15 text-emerald-300';

          return (
            <button
              key={option}
              type="button"
              onClick={() => setTrendType(option)}
              aria-pressed={isActive}
              className={`rounded-[0.9rem] px-3 py-2 text-sm font-black transition-all ${
                isActive ? activeClassName : 'text-gray-400 hover:text-white'
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>

      {hasAnyData && hasVisibleData ? (
        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          className="block w-full"
          role="img"
          aria-label={`近 ${monthCount} 個月${trendType}趨勢圖`}
        >
          {Array.from({ length: AXIS_TICKS + 1 }, (_, tick) => {
            const value = (axisMax / AXIS_TICKS) * tick;
            const y = yForValue(value);

            return (
              <g key={`tick-${tick}`}>
                <line
                  x1={PAD_LEFT}
                  y1={y}
                  x2={VIEW_WIDTH - PAD_RIGHT}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={1}
                />
                <text
                  x={PAD_LEFT - 5}
                  y={y + 3}
                  textAnchor="end"
                  fill="#4b5567"
                  fontSize={8}
                  fontWeight={800}
                >
                  {formatAxisAmount(value)}
                </text>
              </g>
            );
          })}

          {buckets.map((bucket, index) => {
            const columnX = PAD_LEFT + columnWidth * index;
            const isFocused = index === safeFocusIndex;

            return (
              <rect
                key={`highlight-${bucket.year}-${bucket.month}`}
                x={columnX + 1}
                y={PAD_TOP}
                width={Math.max(1, columnWidth - 2)}
                height={PLOT_HEIGHT}
                rx={4}
                fill={isFocused ? 'rgba(255,255,255,0.05)' : 'transparent'}
              />
            );
          })}

          {buckets.map((bucket, index) => {
            const barX = PAD_LEFT + columnWidth * index + (columnWidth - barWidth) / 2;
            const isFocused = index === safeFocusIndex;
            let stackedValue = 0;

            return (
              <g key={`bar-${bucket.year}-${bucket.month}`}>
                {visibleCategoryIds.map((categoryId) => {
                  const point = bucket.categories.find((item) => item.categoryId === categoryId);
                  if (!point || point.total <= 0) return null;

                  const segmentHeight = (point.total / axisMax) * PLOT_HEIGHT;
                  const segmentY = yForValue(stackedValue) - segmentHeight;
                  stackedValue += point.total;

                  return (
                    <rect
                      key={`${categoryId}-${bucket.year}-${bucket.month}`}
                      x={barX}
                      y={segmentY}
                      width={barWidth}
                      height={Math.max(1, segmentHeight)}
                      fill={getCategoryColor(categoryId)}
                      opacity={isFocused ? 1 : 0.82}
                    />
                  );
                })}
              </g>
            );
          })}

          <line
            x1={PAD_LEFT}
            y1={yForValue(averageTotal)}
            x2={VIEW_WIDTH - PAD_RIGHT}
            y2={yForValue(averageTotal)}
            stroke="rgba(255,255,255,0.28)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          {buckets.map((bucket, index) => {
            const labelX = PAD_LEFT + columnWidth * index + columnWidth / 2;
            const isJanuary = bucket.month === 0;
            const isFocused = index === safeFocusIndex;
            const label = isJanuary
              ? `${String(bucket.year).slice(2)}/1`
              : `${bucket.month + 1}`;

            return (
              <text
                key={`label-${bucket.year}-${bucket.month}`}
                x={labelX}
                y={VIEW_HEIGHT - 7}
                textAnchor="middle"
                fill={isFocused ? '#a5f3fc' : isJanuary ? '#94a3b8' : '#64748b'}
                fontSize={8.5}
                fontWeight={800}
              >
                {label}
              </text>
            );
          })}

          {buckets.map((bucket, index) => (
            <rect
              key={`hit-${bucket.year}-${bucket.month}`}
              x={PAD_LEFT + columnWidth * index}
              y={PAD_TOP}
              width={columnWidth}
              height={PLOT_HEIGHT}
              fill="transparent"
              className="cursor-pointer"
              onClick={() => setFocusIndex(index)}
              role="button"
              aria-label={`檢視 ${bucket.year} 年 ${bucket.month + 1} 月`}
            />
          ))}
        </svg>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.025] px-4 py-8 text-center text-xs font-bold text-gray-500">
          {allCategoriesHidden
            ? '沒有選取任何類別'
            : hasAnyData ? '目前選取的類別沒有資料' : `近 ${monthCount} 個月沒有${trendType}紀錄`}
        </div>
      )}

      {hasVisibleData && focusBucket && (
        <div className="mt-3 rounded-[1.2rem] border border-white/8 bg-[#1b1f31]/85 px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs font-black text-gray-300">
              {`${focusBucket.year} 年 ${focusBucket.month + 1} 月`}
            </span>
            <span className={`text-xl font-black tracking-tight ${accentTextClassName}`}>
              {isIncome ? '+' : '-'}{formatAmount(focusTotal)}
            </span>
          </div>

          {focusVisibleRows.length > 0 ? (
            <ul className="mt-2.5 space-y-1.5">
              {focusVisibleRows.map((point) => (
                <li key={point.categoryId} className="flex items-center gap-2 text-[11px] font-bold text-gray-400">
                  <span
                    className="h-2 w-2 shrink-0 rounded-[3px]"
                    style={{ backgroundColor: getCategoryColor(point.categoryId) }}
                  />
                  <span className="min-w-0 flex-1 truncate">{getCategoryName(point.categoryId)}</span>
                  <span className="shrink-0 text-gray-300">{formatAmount(point.total)}</span>
                </li>
              ))}
              {focusRestRows.length > 0 && (
                <li className="flex items-center gap-2 text-[11px] font-bold text-gray-400">
                  <span className="h-2 w-2 shrink-0 rounded-[3px] bg-white/15" />
                  <span className="min-w-0 flex-1 truncate">{`其他 ${focusRestRows.length} 個類別`}</span>
                  <span className="shrink-0 text-gray-300">{formatAmount(focusRestTotal)}</span>
                </li>
              )}
            </ul>
          ) : (
            <p className="mt-2 text-[11px] font-bold text-gray-500">這個月沒有符合條件的紀錄</p>
          )}

          <p className="mt-2.5 text-[10px] font-bold text-gray-600">點長條可切換到其他月份</p>
        </div>
      )}

      {hasVisibleData && (
      <div className="mt-3 grid grid-cols-3 gap-2">
        {summaryTiles.map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500">{tile.label}</p>
            <p className={`mt-1 truncate text-sm font-black tracking-tight ${tile.valueClassName}`}>
              {tile.value}
            </p>
            <p className="mt-0.5 truncate text-[10px] font-bold text-gray-600">{tile.caption}</p>
          </div>
        ))}
      </div>
      )}

      {hasAnyData && (
        <div className="mt-5 border-t border-white/8 pt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-gray-500">
              類別 · 可多選
            </p>
            <div className="flex shrink-0 items-center gap-2">
              {allCategoriesVisible ? null : (
                <button
                  type="button"
                  onClick={() => setHiddenCategoryIds([])}
                  className={bulkSelectButtonClassName}
                >
                  全選
                </button>
              )}
              {allCategoriesHidden ? null : (
                <button
                  type="button"
                  onClick={() => setHiddenCategoryIds(orderedCategoryIds)}
                  className={bulkSelectButtonClassName}
                >
                  取消全選
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {orderedCategoryIds.map((categoryId) => {
              const isHidden = hiddenSet.has(categoryId);

              return (
                <button
                  key={categoryId}
                  type="button"
                  onClick={() => toggleCategory(categoryId)}
                  aria-pressed={!isHidden}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-black transition-all active:scale-95 ${
                    isHidden
                      ? 'border-white/10 bg-white/5 text-gray-500 opacity-40'
                      : 'border-white/20 bg-white/10 text-gray-100'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                    style={{ backgroundColor: getCategoryColor(categoryId) }}
                  />
                  {getCategoryName(categoryId)}
                  <span className="text-[10px] font-bold text-gray-500">
                    {formatCompactAmount(categoryTotals.get(categoryId) || 0)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyTrendChart;
