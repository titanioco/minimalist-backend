// @ts-nocheck
import {
	Entity,
	BaseEntity,
	PrimaryGeneratedColumn,
	Column,
	CreateDateColumn,
	UpdateDateColumn,
} from "typeorm";
import { NETWORK } from "..";

@Entity({ name: "appConfig" })
export class AppConfigEntity extends BaseEntity {
	@PrimaryGeneratedColumn("uuid")
	id: string;

	@Column("integer", { default: NETWORK })
	chain_id: number;

	@Column("integer", { nullable: false })
	block_number: number;

	@CreateDateColumn()
	created_at: Date;

	@UpdateDateColumn()
	updated_at: Date;
}
