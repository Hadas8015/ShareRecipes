// מחלקה המייצגת משתמש - כולל תפקיד (Admin/Uploader/Reader) וסטטוס אישור

export class User {
    constructor(
        public id?: number,
        public name?: string,
        public email: string = '',
        public role: 'Admin' | 'Uploader' | 'Reader' = 'Reader',
        public is_approved_uploader: boolean = false,
        public was_rejected: boolean = false,
        public bio: string = '',
        public password?: string
    ) { }
}