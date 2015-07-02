var util = require("util");
var helpers = require("../helpers");
var Policy = require("../s3post").Policy;
var S3Form = require("../s3post").S3Form;
var AWS_CONFIG_FILE = "config.json";
var POLICY_FILE = "policy.json";
var INDEX_TEMPLATE = "index.ejs";
var AWS = require("aws-sdk");
AWS.config.loadFromPath('./config.json');
var s3 = new AWS.S3();
var APP_CONFIG_FILE = "./app.json";
var tablicaKolejki = helpers.readJSONFile(APP_CONFIG_FILE);
var linkKolejki = tablicaKolejki.QueueUrl
var sqs=new AWS.SQS();
var UPLOAD_TEMPLATE = "upload.ejs";

var simpledb = new AWS.SimpleDB();

var task = function(request, callback){
	

	var paramsDomainInfo = {
	DomainName: 'borowieckaLOG'
	};

	simpledb.createDomain(paramsDomainInfo, function(err,data) {
	if(err) console.log(err, err.stack);
	else	console.log("Baza danych info założona");
	});
	
	var params = {
		Bucket: 'borowiecka',
		Prefix: 'obrazki'
	};
	
	s3.listObjects(params, function(err, data) {
		if (err) console.log(err, err.stack);
		else     console.log(data);
		
		
		var linki = [];
		var i ;
		for(i in data.Contents) {
			if (data.Contents[i].Key != "obrazki/"){
				//dopisanie do listy do wyświetlenia
				linki.push( {nazwa: data.Contents[i].Key.substring(8)});
			}
			console.log(i);
		}
	

		if(data.Contents[i].Key != "obrazki/")
		{
		    //adres hosta który wrzucał obrazek,
    		var ipAddress = request.connection.remoteAddress;
    		console.log(ipAddress);
    		
    		//ładuje config amazona
    		var awsConfig = helpers.readJSONFile(AWS_CONFIG_FILE);
    		
    		//ładuje config z danymi gdzie wrzucić plik i akcją powrotną
    		var policyData = helpers.readJSONFile(POLICY_FILE);
    
    		//przygotowuje obiekt konfiguracji wrzucania na s3
    		var policy = new Policy(policyData);
    		
    		//generuje pola (inputy) wrzucania na s3
    		var s3Form = new S3Form(policy);
    		var fields = s3Form.generateS3FormFields();
    		
    		//tag dla pliku wrzucającego (widoczny w AWS console)
    		fields.push( {name : 'x-amz-meta-uploader', value : 'Izabela Borowiecka'});
    		//tag dla pliku ip (widoczny w AWS console)
    		fields.push( {name : 'x-amz-meta-ip', value : ipAddress});
    	
    		//dodaje niewidoczne pola potrzebne do uploadu
    		var fieldsSecret=s3Form.addS3CredientalsFields(fields, awsConfig);
    		
			var bucket =  'borowiecka';
			var key =  data.Contents[i].Key.toString();
			
			//tablica z parametrami do pobrania naszego wrzuconego pliku i meta danych dla getObject
			var params = {
				Bucket: bucket,
				Key: key
			};

			//pobieramy plik (obiekt) i dane o nim
			s3.getObject(params, function(err, data) {
    			if (err) {
    				//jeżeli nie wrzucono takiego pliku a jest próba odwołania się do niego będzie log na konsoli
    				console.log(err, err.stack);
    			}
    			else {
    			
    			    //sprawdzamy czy plik był już przetworzony
    			    var paramsCheck = {
    				DomainName: 'borowieckaLOG', //required 
    				ItemName: 'ITEM001', // required 
    				AttributeNames: [
    					key,
    				],
    			};
    				
			    simpledb.getAttributes(paramsCheck, function(err, datacc) {
			    if (err) {
					console.log(err, err.stack); // an error occurred
					callback(null, "Nie ma takiego pliku.");
				}
				else 
				{  
				    //poszukuje pliku i sprawdza czy był już przetworzony 
					if(datacc.Attributes && datacc.Attributes[0].Value == "yes")
					{
						console.log('Plik był przetworzony');
						callback(null, {template: UPLOAD_TEMPLATE, params:{fileName:key.substring(8), bucket:"borowiecka"}});
					}
					else
					{
						console.log('Brak przetworzonego pliku');
						
						//Po poprawnym wrzuceniu pliku i pobraniu jego danych
						console.log("Plik zostal wrzucony poprawnie i jego dane zostaly odczytane");
						
								//wrzuca do bazy dane (ip wrzucającego)
								var paramsdb2 = {
									Attributes: [
										{ Name: key, Value: ipAddress, Replace: true}
									],
									DomainName: "borowieckaLOG", 
									ItemName: 'ITEM001'
								};
								
								simpledb.putAttributes(paramsdb2, function(err, datass) {
									if (err) {
										console.log('ERROR'+err, err.stack);
									}
									else {
										//obiekt z parametrami do wysłania wiadomości dla kolejki 
										var sendparms={
											//MessageBody: bucket, key,
											MessageBody: "{\"bucket\":\""+bucket+"\",\"key\":\""+key+"\"} ",
											QueueUrl: linkKolejki,
											MessageAttributes: {
												key: {
													DataType: 'String',
													StringValue: key
												},
												bucket: {
													DataType: 'String',
													StringValue: bucket
												}
											}	
										};
										
										//wysłanie wiadomości do kolejki
										sqs.sendMessage(sendparms, function(err,data2){
											if(err) {
												console.log(err,err.stack);
												callback(null,'error');
											}
											else {
												console.log("Skrót dodania do kolejki -> MessageId: "+data2.MessageId);
											}
										});
										//odczytuje z bazy dane 
										/*	var paramsCheck1 = {
											    DomainName: 'borowieckaStatus', //required 
											    ItemName: 'ITEM001', // required 
										    };*/
											var paramsCheck2 = {
										    	DomainName: 'borowieckaLOG', //required 
										    	ItemName: 'ITEM001', // required 
											};
											simpledb.getAttributes(paramsCheck2, function(err, data) {
												if (err) {
													console.log(err, err.stack); // an error occurred
												}
												else {     
													console.log(data);           // successful response
												}
											});		
						
							}  
						});
					}
				}
			});	
		}
	});
	}

	callback(null, {template: INDEX_TEMPLATE, params:{fields:fields, bucket:"borowiecka", fileList:linki}});
});
}

function testx(){
	
}


exports.action = task;
