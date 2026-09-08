import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('audit_logs')
@Index(['userId'])
@Index(['action'])
@Index(['createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, (user) => user.auditLogs, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ type: 'varchar', length: 100 })
  action: string;

  @Column({ type: 'varchar', length: 100, name: 'ip_address' })
  ipAddress: string;

  @Column({ type: 'text', name: 'user_agent', nullable: true })
  userAgent: string | null;

  @CreateDateColumn({
    type: 'timestamptz',
    name: 'created_at',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;
}
