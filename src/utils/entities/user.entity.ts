// @ts-nocheck
import {
	Entity,
	BaseEntity,
	PrimaryColumn,
	Column,
	CreateDateColumn,
	UpdateDateColumn,
	ManyToOne,
} from "typeorm";
import { NETWORK } from "../";

@Entity({ name: "user" })
export class UserEntity extends BaseEntity {
	@PrimaryColumn("text")
	address: string;

	@ManyToOne(() => UserEntity, { nullable: true })
	referrer: UserEntity;

	@Column("text", { unique: true, nullable: false })
	code: string;

	@Column("text", { unique: true, nullable: false })
	wallet_address: string;

	@Column("text", { nullable: false })
	recipient: string;

	@Column("integer", { default: NETWORK })
	chain_id: number;

	@Column("integer", { default: 0 })
	nonce: number;

	@Column("float8", { default: 1.1 })
	safe_hf: number;

	@Column("float8", { default: 1.03 })
	risk_hf: number;

	@Column("text", { default: "00:00" })
	cron_time: string;

	@Column("boolean", { default: true })
	deposit_enabled: boolean;

	@Column("boolean", { default: true })
	protection_enabled: boolean;

	@Column("float8", { default: 0 })
	deposit_amount: number;

	@Column("float8", { default: 10 })
	deposit_buffer: number;

	@Column("boolean", { nullable: true, default: false })
	need_update: boolean;

	@Column("float8", { nullable: true })
	updated_deposit_amount: number | null;

	@Column("timestamptz", { nullable: true, default: null })
	last_deposited_at: Date;

	@Column("timestamptz", { nullable: true, default: null })
	last_swapped_at: Date;

	@CreateDateColumn()
	created_at: Date;

	@UpdateDateColumn()
	updated_at: Date;
}
