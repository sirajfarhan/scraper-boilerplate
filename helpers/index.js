const fs = require('fs');
const stringSimilarity = require('string-similarity');
const { S3 } = require('aws-sdk');

function getEmailAddress(string) {
    const EMAIL_REGEX =  /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/gi
    const result = string.match(EMAIL_REGEX);
    return result ? result : []
}

function getWebsites(string) {
    const WEBSITE_REGEX = /^((ftp|http|https):\/\/)?(www.)?(?!.*(ftp|http|https|www.))[a-zA-Z0-9_-]+(\.[a-zA-Z]+)+((\/)[\w#]+)*(\/\w+\?[a-zA-Z0-9_]+=\w+(&[a-zA-Z0-9_]+=\w+)*)?$/gi
    const result = string.match(WEBSITE_REGEX);
    return result ? result : []
}

function getPhoneNumber(string) {
    const PHONE_NUMBER_REGEX = /(?:(?:\+?([1-9]|[0-9][0-9]|[0-9][0-9][0-9])\s*(?:[.-]\s*)?)?(?:\(\s*([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9])\s*\)|([0-9][1-9]|[0-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9]))\s*(?:[.-]\s*)?)?([2-9]1[02-9]|[2-9][02-9]1|[2-9][02-9]{2})\s*(?:[.-]\s*)?([0-9]{4})(?:\s*(?:#|x\.?|ext\.?|extension)\s*(\d+))?/gi
    // const result = string.match(PHONE_NUMBER_REGEX).filter(number => number !== '996-2020');
    const result = string.match(PHONE_NUMBER_REGEX);
    return result ? result : []
}

function writeData(fileName, jsonData, json = true) {
    return new Promise((resolve, reject) => {
        fs.writeFile(
            fileName,
            JSON.stringify(jsonData),
            err => {
                if (err) return reject(err);
                return resolve();
            }
        );
    });
}

function readData(fileName, json = true) {
    return new Promise((resolve, reject) => {
        fs.readFile(fileName, (err, data) => {
            if (err) return reject(err);
            return resolve(json ? JSON.parse(data) : data);
        })
    })
}

function cleanNumber(number){
    return number?number.replace(/ /g,'').replace(/-/g,''):''
}

function getVerifiedIndices(data) {
    const facebookPhone  = data.map(brand => cleanNumber(brand.facebookPhone));
    const amazonPhone = data.map(brand => cleanNumber(brand.numbers)).map(brand => brand.split(','));

    const results = facebookPhone.map((phone,index) => phone ? stringSimilarity.findBestMatch(phone, amazonPhone[index]) : null);
    return results.map((result, index) => (result && result.bestMatch.rating > 0.7) ? index : null).filter(r => r);
}

function updateVerifiedDetails(data) {
    const indices = getVerifiedIndices(data);

    data = data.map((item,index)=> {
        item.emailVerified = 'NO';
        item.phoneVerified = 'NO';
        item.facebookPageVerified = 'NO';
        item.websiteVerified = 'NO';

        if(item.emails && item.emails !== 'NA') {
            item.emailVerified = 'YES';
        }

        if(indices.includes(index)) {
            item.phoneVerified = 'YES';
            item.facebookPageVerified = 'YES';
            if(item.facebookEmail && item.facebookEmail !== 'NA') {
                item.emailVerified = 'YES'
            }
            if(item.facebookWebsite && item.facebookWebsite !== 'NA') {
                item.websiteVerified = 'YES'
            }
        }
        return item
    });

    return data;
}

function fixUrl(url) {
    if(url && !url.startsWith('http')) {
        url = `https://${url}`
    }

    if(url && url.startsWith('http://')) {
        url = url.replace('http://','https://')
    }

    return url
}

function tagAmazonUrlType(sellers) {
    sellers = sellers.map(seller => {
        seller['store_url'] = fixUrl(seller['store_url']);
        return seller;
    });


    sellers = sellers.map(seller => {
        if(seller['store_url']) {
            const url = new URL(seller['store_url']);
            seller['amazon_page_type'] = url.pathname === '/sp' ? 'SELLER' : 'NOT_SELLER';
            return url.pathname;
        } else {
            seller['amazon_page_type'] = 'NOT_FOUND';
        }
        return seller;
    });

    return sellers;
}

async function createS3Bucket(bucketName) {
    return new Promise((resolve, reject) => {
        const s3 = new S3();
        const bucketParams = {
            Bucket: bucketName
        };
        s3.createBucket(bucketParams,  (err, data) => {
            if (err) return reject(err);
            return resolve(data);
        });
    });
}

async function writeDataToS3(bucketName, fileName, data, json=true) {
    return new Promise((resolve, reject) => {
        const s3 = new S3();
        const params = {
            Bucket: bucketName,
            Key: fileName,
            Body: json ? JSON.stringify(data) : data,
        };
        s3.putObject(params, (err, data) => {
            if (err) return reject(err);
            return resolve(data);
        });
    });
}

async function readDataFromS3(bucketName, fileName, json=true) {
    return new Promise((resolve, reject) => {
        const s3 = new S3();
        const params = {
            Bucket: bucketName,
            Key: fileName
        };
        s3.getObject(params, (err, data) => {
            if (err) return reject(err);
            return resolve(json ? JSON.parse(data.Body.toString()) : data.Body.toString());
        });
    });
}



module.exports = {
    getEmailAddress,
    getWebsites,
    getPhoneNumber,
    writeData,
    readData,
    cleanNumber,
    updateVerifiedDetails,
    fixUrl,
    tagAmazonUrlType,
    readDataFromS3,
    writeDataToS3,
    createS3Bucket,
};

