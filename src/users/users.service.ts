import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DrizzleService } from '../database/drizzle.service';
import { users, User, NewUser } from '../database/schema';

@Injectable()
export class UsersService {
  constructor(private readonly db: DrizzleService) {}

  async findById(id: string): Promise<User | null> {
    const [user] = await this.db.db.select().from(users).where(eq(users.id, id)).limit(1);
    return user ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [user] = await this.db.db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    return user ?? null;
  }

  async create(data: NewUser): Promise<User> {
    const [user] = await this.db.db
      .insert(users)
      .values({ ...data, email: data.email.toLowerCase() })
      .returning();
    return user;
  }

  async update(id: string, data: Partial<Pick<User, 'name' | 'email' | 'avatarUrl' | 'passwordHash'>>): Promise<User> {
    const [updated] = await this.db.db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }

  /** Strip password hash before returning to client */
  toProfile(user: User) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...profile } = user;
    return profile;
  }
}
