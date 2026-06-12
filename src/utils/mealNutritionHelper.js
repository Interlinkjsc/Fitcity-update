/**
 * Chia chỉ số dinh dưỡng ngày theo tỷ lệ kcal từng bữa (hoặc chia đều nếu chưa có kcal món).
 */
function computeMealNutrition(mealPlan) {
    try {
        if (!mealPlan || !Array.isArray(mealPlan.meals) || mealPlan.meals.length === 0) {
            return [];
        }
        const dailyCal = Number(mealPlan.dailyCalories) || 2000;
        const macros = mealPlan.macros || { protein: 30, carbs: 35, fat: 25, fiber: 10 };
        const mealCalsList = mealPlan.meals.map((meal) =>
            (meal.foodItems || []).reduce((sum, f) => sum + (Number(f.calories) || 0), 0)
        );
        const totalFoodCals = mealCalsList.reduce((a, b) => a + b, 0);
        const n = mealPlan.meals.length;

        return mealPlan.meals.map((meal, idx) => {
            const fromFood = mealCalsList[idx];
            const kcal =
                fromFood > 0
                    ? fromFood
                    : totalFoodCals > 0
                      ? Math.round((dailyCal * fromFood) / totalFoodCals) || Math.round(dailyCal / n)
                      : Math.round(dailyCal / n);
            const ratio = dailyCal > 0 ? kcal / dailyCal : 1 / n;
            const proteinG = Math.round((dailyCal * (Number(macros.protein) || 0)) / 100 * ratio / 4);
            const carbsG = Math.round((dailyCal * (Number(macros.carbs) || 0)) / 100 * ratio / 4);
            const fatG = Math.round((dailyCal * (Number(macros.fat) || 0)) / 100 * ratio / 9);
            const fiberG = Math.round((dailyCal * (Number(macros.fiber) || 0)) / 100 * ratio / 2);
            const nameFromNotes =
                meal.notes && String(meal.notes).includes(':')
                    ? String(meal.notes).split(':')[0].trim()
                    : meal.notes || '';
            return {
                kcal,
                proteinG,
                carbsG,
                fatG,
                fiberG,
                label: nameFromNotes || meal.time || `Bữa ${idx + 1}`
            };
        });
    } catch (err) {
        console.error('[computeMealNutrition] Error:', err.message);
        return [];
    }
}

function parseMealFoodsText(text) {
    if (!text || !String(text).trim()) return [];
    return String(text)
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((line) => {
            const calMatch = line.match(/(\d+)\s*kcal/i);
            const calories = calMatch ? Number(calMatch[1]) : 0;
            const qtyMatch = line.match(/\(([^)]+)\)\s*$/);
            const name = line.replace(/\(\d+\s*kcal\)/i, '').replace(/\([^)]+\)\s*$/, '').trim();
            return {
                name: name || line,
                quantity: qtyMatch ? qtyMatch[1] : '',
                calories
            };
        });
}

module.exports = { computeMealNutrition, parseMealFoodsText };
