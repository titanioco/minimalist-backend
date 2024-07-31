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

@Entity({ name: "valueRecord" })
export class ValueRecordEntity extends BaseEntity {
	@PrimaryGeneratedColumn("uuid")
	id: string;

	@ManyToOne(() => UserEntity, { nullable: false })
	user: UserEntity;

	@Column("integer", { default: NETWORK })
	chain_id: number;

	@Column("text", { default: "0" })
	value: string;

	@Column("text", { default: "0" })
	totalDebtBase: string;

	@CreateDateColumn()
	created_at: Date;

	@UpdateDateColumn()
	updated_at: Date;
}
