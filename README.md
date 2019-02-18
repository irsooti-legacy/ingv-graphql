![](http://itaca.mi.ingv.it/ItacaNet/img/logoingv.png) 
# INGV
### GraphQL api

Api di INGV (http://webservices.ingv.it/fdsnws/event/1/query) in graphQL.


```graphql
query {
  events(starttime: null, endtime: null, maxmag: 0) {
    quakes {
      description
      creationInfo {
        author
        agencyID
        creationTime
      }
    }
  }
}
```
