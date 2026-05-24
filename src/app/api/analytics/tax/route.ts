import { NextRequest, NextResponse } from "next/server";
import { getHoldings } from "@/lib/storage";
import { fetchCurrentPrices } from "@/lib/market";
import { TaxHoldingDetail, TaxSummary } from "@/models/types";

/**
 * GET: Calculate Unrealized Capital Gains Tax and Tax-Loss Harvesting Opportunities
 */
export async function GET() {
  try {
    const holdings = await getHoldings();
    
    if (holdings.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          shortTermGains: 0,
          longTermGains: 0,
          estimatedShortTermTax: 0,
          estimatedLongTermTax: 0,
          totalEstimatedTax: 0,
          taxLossHarvestingOpportunity: 0,
          harvestableAssets: [],
          details: [],
        } as TaxSummary,
      });
    }

    const prices = await fetchCurrentPrices(holdings);
    const now = new Date();

    const details: TaxHoldingDetail[] = [];
    const harvestableAssets: TaxHoldingDetail[] = [];

    let shortTermGains = 0;
    let longTermGains = 0;
    let estimatedShortTermTax = 0;
    let estimatedLongTermTax = 0;
    let taxLossHarvestingOpportunity = 0;

    for (const h of holdings) {
      const priceInfo = prices[h.symbol];
      const livePrice = priceInfo ? priceInfo.price : h.buyPrice * h.exchangeRate;
      
      const buyPriceINR = h.buyPrice * h.exchangeRate;
      const investedValueINR = h.quantity * buyPriceINR;
      const currentValueINR = h.quantity * livePrice;
      const unrealizedGainINR = currentValueINR - investedValueINR;

      // Calculate holding period in days
      const buyDate = new Date(h.buyDate);
      const diffTime = Math.abs(now.getTime() - buyDate.getTime());
      const holdingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Categorize holding period and tax rates
      let holdingPeriodCategory: "SHORT_TERM" | "LONG_TERM" = "SHORT_TERM";
      let taxRatePercent = 20; // Default Equity STCG rate is 20%
      let estimatedTax = 0;

      if (h.type === "stock" || h.type === "mutual_fund") {
        // Equity Assets (Stocks & Equity Mutual Funds)
        if (holdingDays > 365) {
          holdingPeriodCategory = "LONG_TERM";
          taxRatePercent = 12.5; // LTCG Equity is 12.5%
          if (unrealizedGainINR > 0) {
            longTermGains += unrealizedGainINR;
            estimatedTax = unrealizedGainINR * 0.125;
          }
        } else {
          holdingPeriodCategory = "SHORT_TERM";
          taxRatePercent = 20; // STCG Equity is 20%
          if (unrealizedGainINR > 0) {
            shortTermGains += unrealizedGainINR;
            estimatedTax = unrealizedGainINR * 0.20;
          }
        }
      } else if (h.type === "gold" || h.type === "sgb") {
        // Gold and SGB alternate assets
        // Under FY 24-25, Gold spot / Digital gold gains are taxed at slab rates (represented here as standard 30% marginal rate)
        // For SGB: exempt at maturity (8 years). If sold before: STCG if <= 3 years (1095 days) taxed at slab (30%), LTCG if > 3 years (20%)
        if (h.type === "sgb") {
          if (holdingDays > 2922) {
            // > 8 years: Fully tax-exempt
            holdingPeriodCategory = "LONG_TERM";
            taxRatePercent = 0;
            estimatedTax = 0;
          } else if (holdingDays > 1095) {
            holdingPeriodCategory = "LONG_TERM";
            taxRatePercent = 20; // LTCG 20%
            if (unrealizedGainINR > 0) {
              longTermGains += unrealizedGainINR;
              estimatedTax = unrealizedGainINR * 0.20;
            }
          } else {
            holdingPeriodCategory = "SHORT_TERM";
            taxRatePercent = 30; // STCG taxed at marginal slab
            if (unrealizedGainINR > 0) {
              shortTermGains += unrealizedGainINR;
              estimatedTax = unrealizedGainINR * 0.30;
            }
          }
        } else {
          // Digital Gold: slab rate (30% marginal estimation)
          holdingPeriodCategory = holdingDays > 1095 ? "LONG_TERM" : "SHORT_TERM";
          taxRatePercent = 30;
          if (unrealizedGainINR > 0) {
            if (holdingPeriodCategory === "LONG_TERM") {
              longTermGains += unrealizedGainINR;
            } else {
              shortTermGains += unrealizedGainINR;
            }
            estimatedTax = unrealizedGainINR * 0.30;
          }
        }
      }

      const detail: TaxHoldingDetail = {
        id: h.id,
        symbol: h.symbol,
        name: h.name,
        type: h.type,
        quantity: h.quantity,
        buyPriceINR: Number(buyPriceINR.toFixed(2)),
        currentPriceINR: Number(livePrice.toFixed(2)),
        investedValueINR: Number(investedValueINR.toFixed(2)),
        currentValueINR: Number(currentValueINR.toFixed(2)),
        unrealizedGainINR: Number(unrealizedGainINR.toFixed(2)),
        holdingDays,
        holdingPeriodCategory,
        taxRatePercent,
        estimatedTaxINR: Number(Math.max(0, estimatedTax).toFixed(2)),
      };

      // Add tax-loss harvesting recommendation
      if (unrealizedGainINR < 0) {
        // Loss can offset tax. Tax savings = magnitude of loss * taxRate
        const potentialSavings = Math.abs(unrealizedGainINR) * (taxRatePercent / 100);
        detail.recommendation = `Harvest Loss: Offset up to ₹${Math.abs(unrealizedGainINR).toFixed(0)} of gains. Saves ~₹${potentialSavings.toFixed(0)} in tax.`;
        
        taxLossHarvestingOpportunity += potentialSavings;
        harvestableAssets.push(detail);
      }

      details.push(detail);
    }

    // Adjust longTermGains estimated tax with the ₹1.25 Lakh overall exemption limit for LTCG equity.
    // In a simple estimation, if total longTermGains (across equity) > 125,000, we apply 12.5% only on the excess.
    // Let's implement this elegant macro adjustment!
    let totalLtcgTax = 0;
    if (longTermGains > 125000) {
      totalLtcgTax = (longTermGains - 125000) * 0.125;
    } else {
      totalLtcgTax = 0; // Below exemption limit
    }

    // Since we also have Gold/SGB in LTCG at 20%, we add their specific tax values
    const nonExemptLtcgTax = details
      .filter((d) => d.holdingPeriodCategory === "LONG_TERM" && d.type !== "stock" && d.type !== "mutual_fund" && d.unrealizedGainINR > 0)
      .reduce((sum, d) => sum + d.estimatedTaxINR, 0);

    estimatedLongTermTax = totalLtcgTax + nonExemptLtcgTax;
    estimatedShortTermTax = shortTermGains * 0.20 + details
      .filter((d) => d.holdingPeriodCategory === "SHORT_TERM" && d.type !== "stock" && d.type !== "mutual_fund" && d.unrealizedGainINR > 0)
      .reduce((sum, d) => sum + d.estimatedTaxINR, 0);

    const totalEstimatedTax = estimatedShortTermTax + estimatedLongTermTax;

    const summary: TaxSummary = {
      shortTermGains: Number(shortTermGains.toFixed(2)),
      longTermGains: Number(longTermGains.toFixed(2)),
      estimatedShortTermTax: Number(estimatedShortTermTax.toFixed(2)),
      estimatedLongTermTax: Number(estimatedLongTermTax.toFixed(2)),
      totalEstimatedTax: Number(totalEstimatedTax.toFixed(2)),
      taxLossHarvestingOpportunity: Number(taxLossHarvestingOpportunity.toFixed(2)),
      harvestableAssets,
      details,
    };

    return NextResponse.json({ success: true, data: summary });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
