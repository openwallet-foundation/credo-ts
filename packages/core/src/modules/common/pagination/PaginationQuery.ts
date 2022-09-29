import { Transform } from 'class-transformer'
import { IsInt, IsOptional, IsPositive, Min } from 'class-validator'

export class PaginationQuery {
  @Transform((offset) => parseInt(offset.value, 10))
  @IsOptional()
  @Min(0)
  @IsInt()
  public readonly offset: number = 0

  @Transform((limit) => parseInt(limit.value, 10))
  @IsOptional()
  @IsPositive()
  @IsInt()
  public readonly limit: number = 50

  public constructor(props?: PaginationQuery) {
    if (props) {
      this.offset = props.offset
      this.limit = props.limit
    }
  }
}
