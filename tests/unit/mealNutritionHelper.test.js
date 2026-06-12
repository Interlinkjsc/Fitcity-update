const { computeMealNutrition, parseMealFoodsText } = require('../../src/utils/mealNutritionHelper');

describe('mealNutritionHelper', () => {
    it('splits daily macros across meals evenly when no food calories', () => {
        const plan = {
            dailyCalories: 2000,
            macros: { protein: 30, carbs: 40, fat: 20, fiber: 10 },
            meals: [{ time: '07:00' }, { time: '12:00' }]
        };
        const rows = computeMealNutrition(plan);
        expect(rows).toHaveLength(2);
        expect(rows[0].kcal).toBe(1000);
        expect(rows[0].proteinG).toBeGreaterThan(0);
    });

    it('parseMealFoodsText extracts items', () => {
        const items = parseMealFoodsText('Trứng luộc (2 quả), Cơm gạo lứt');
        expect(items.length).toBe(2);
        expect(items[0].name).toContain('Trứng');
    });
});
