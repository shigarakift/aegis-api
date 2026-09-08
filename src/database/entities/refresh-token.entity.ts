import {
  Column,
  CreateDateColumn,
  Entity,
  Generated,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('refresh_tokens')
@Index(['userId', 'isRevoked', 'expiresAt'])
@Index(['familyId'])
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, name: 'token_hash' })
  tokenHash: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, (user) => user.refreshTokens, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt: Date;

  @Column({ type: 'boolean', name: 'is_revoked', default: false })
  isRevoked: boolean;

  @CreateDateColumn({
    type: 'timestamptz',
    name: 'created_at',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @Column({ type: 'uuid', name: 'family_id' })
  @Generated('uuid')
  familyId: string;
}
