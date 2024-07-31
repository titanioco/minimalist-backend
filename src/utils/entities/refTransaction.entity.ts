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

@Entity({ name: "refTransaction" })
export class RefTransactionEntity extends BaseEntity {
	@PrimaryGeneratedColumn("uuid")
	id: string;

	@Column("text", { nullable: true })
	hash: string;

	@ManyToOne(() => UserEntity, { nullable: false })
	from: UserEntity;

	@ManyToOne(() => UserEntity, { nullable: false })
	to: UserEntity;

	@Column("integer", { default: NETWORK })
	chain_id: number;

	@Column("enum", {
		enum: ["pending", "success", "fail"],
		default: "fail",
	})
	status: "pending" | "success" | "fail";

	@Column("text")
	description: string;

	@Column("text", { default: "0" })
	amount: string;

	@CreateDateColumn()
	created_at: Date;

	@UpdateDateColumn()
	updated_at: Date;
}
