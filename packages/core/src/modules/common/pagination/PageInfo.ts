import { Transform } from 'class-transformer'
import { IsInt, Min } from 'class-validator'

export class PageInfo {
  @Transform((remaining) => parseInt(remaining.value, 10))
  @IsInt()
  @Min(0)
  public readonly remaining: number

  @Transform((offset) => parseInt(offset.value, 10))
  @IsInt()
  @Min(0)
  public readonly offset: number

  @Transform((count) => parseInt(count.value, 10))
  @IsInt()
  @Min(0)
  public readonly count: number

  public constructor(props: PageInfo) {
    this.remaining = props.remaining
    this.offset = props.offset
    this.count = props.count
  }
}
