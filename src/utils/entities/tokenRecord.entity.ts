// @ts-nocheck
import {
	Entity,
	BaseEntity,
	PrimaryGeneratedColumn,
	Column,
	ManyToOne,
	CreateDateColumn,
	UpdateDateColumn,
} from "typeorm";
import { NETWORK } from "..";
import { UserEntity } from "./user.entity";

@Entity({ name: "tokenRecord" })
export class TokenRecordEntity extends BaseEntity {
	@PrimaryGeneratedColumn("uuid")
	id: string;

	@ManyToOne(() => UserEntity, { nullable: false })
	user: UserEntity;

	@Column("integer", { default: NETWORK })
	chain_id: number;

	@Column("integer", { nullable: false })
	block_number: number;

	@Column("integer", { nullable: false })
	log_index: number;

	@Column("text", { nullable: true })
	hash: string;

	@Column("enum", {
		enum: ["deposit", "withdraw"],
		nullable: false,
	})
	type: "deposit" | "withdraw";

	@Column("text", { nullable: false })
	token: string;

	@Column("text", { nullable: false })
	token_price: string;

	@Column("text", { nullable: false })
	value: string;

	@CreateDateColumn()
	created_at: Date;

	@UpdateDateColumn()
	updated_at: Date;
}
