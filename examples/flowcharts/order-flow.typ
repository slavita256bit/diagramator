#import "../../../bsuir-core/src/block-schemes/lib.typ" as blocks
#import "flowchart.typ": draw-flowchart

#let order-flow() = draw-flowchart(json("order.json"), blocks)
