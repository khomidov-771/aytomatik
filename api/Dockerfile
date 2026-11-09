FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /ids-api ./cmd/server && CGO_ENABLED=0 go build -o /ids-seed ./cmd/seed

FROM alpine:3.22
RUN adduser -D -H ids
USER ids
COPY --from=build /ids-api /ids-api
COPY --from=build /ids-seed /ids-seed
EXPOSE 8080
ENTRYPOINT ["/ids-api"]

