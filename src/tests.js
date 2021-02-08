export const tests = [
  {
    name:   "whole-site a-b test",
    type:   testTypes.noCache,
    start:  new Date('2021-01-01T00:00:00Z'), // default to UTC (Zulu) time, but can use other TZs
    end:    new Date('2022-01-01T00:00:00Z'),
    path:   "/",
    cookie: "site-a-b",
    header: "x-site-a-b",
    split: [
      {
        label: "A",
        percentage: 50
      },
      {
        label: "B",
        percentage: 50
      },
    ]
  }
]
