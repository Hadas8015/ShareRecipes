// מחלקה המייצגת רכיב במתכון - שם, כמות ויחידת מידה

export class IngredientEntry {
    constructor(
        public name: string = '',
        public id?: number,
        public product: string = '',
        public amount: number = 0,
        public unit: string = '',
        public recipe_id?: number
    ) { }
}