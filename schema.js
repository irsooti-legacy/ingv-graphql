const fetch = require('node-fetch');
const util = require('util');
const { URLSearchParams } = require('url');
const parseXML = util.promisify(require('xml2js').parseString);
const {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLList,
  GraphQLFloat
} = require('graphql');

const QuakeType = new GraphQLObjectType({
  name: 'Quake',
  description: 'Evento sismico',

  fields: () => ({
    description: {
      type: GraphQLString
    },
    origin: {
      type: OriginType
    },
    creationInfo: {
      type: CreationInfo
    }
  })
});

const OriginType = new GraphQLObjectType({
  name: 'Origin',
  description: "Origine dell'evento sismico",

  fields: () => ({
    latitude: {
      type: GraphQLFloat
    },
    longitude: {
      type: GraphQLFloat
    },
    time: { type: GraphQLString },
    uncertainty: { type: GraphQLFloat }
  })
});

const CreationInfo = new GraphQLObjectType({
  name: 'CreationInfo',
  description: 'Chi ha creato il dato',

  fields: () => ({
    agencyID: {
      type: GraphQLString
    },
    author: {
      type: GraphQLString
    },
    creationTime: {
      type: GraphQLString
    }
  })
});

const QuakesType = new GraphQLObjectType({
  name: 'Quakes',
  description: 'Una lista di eventi sismici',

  fields: () => ({
    quakes: {
      type: new GraphQLList(QuakeType),
      resolve: xml => {
        return xml['q:quakeml']['eventParameters'][0].event.map(event => ({
          description: event.description[0].text[0],

          origin: {
            latitude: event.origin[0].latitude[0].value[0],
            longitude: event.origin[0].longitude[0].value[0],
            time: event.origin[0].time[0].value[0],
            uncertainty: event.origin[0].time[0].uncertainty[0]
          },
          creationInfo: {
            agencyID: event.creationInfo[0].agencyID[0],
            author: event.creationInfo[0].author[0],
            creationTime: event.creationInfo[0].creationTime[0]
          }
        }));
      }
    }
  })
});

module.exports = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    description:
      'Ritorna tutti gli eventi sismici riportati in un certo periodo',

    fields: () => {
      const prevDate = new Date();
      prevDate.setMonth(prevDate.getMonth() - 1);

      return {
        events: {
          type: QuakesType,
          args: {
            starttime: {
              type: GraphQLString,
              defaultValue: prevDate.toISOString()
            },
            endtime: {
              type: GraphQLString,
              defaultValue: new Date().toISOString()
            },
            maxmag: { type: GraphQLFloat, defaultValue: 100 },
            minmag: { type: GraphQLFloat, defaultValue: 0 }
          },
          resolve: (root, args) => {
            const endpoint = `http://webservices.ingv.it/fdsnws/event/1/query`;
            const params = new URLSearchParams();
            Object.keys(args).map(arg =>
              args[arg] ? params.append(arg, args[arg]) : null
            );

            return fetch(endpoint + '?' + params.toString())
              .then(response => response.text())
              .then(parseXML);
          }
        }
      };
    }
  })
});
