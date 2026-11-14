package main

import (
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/awslabs/aws-lambda-go-api-proxy/httpadapter"
)

func main() {
	setupLogger()
	router := newRouter()
	if runningOnLambda() {
		// WHY: o mesmo router atende os dois runtimes; na Lambda, o adaptador
		// converte o payload 2.0 do HTTP API em requisição net/http.
		lambda.Start(httpadapter.NewV2(router).ProxyWithContext)
		return
	}
	serve(router)
}
