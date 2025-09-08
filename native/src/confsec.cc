#include <napi.h>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>
#include "libconfsec.h"

using namespace std;

// Helper macros for error handling
#define INIT_ERROR char* err = nullptr;
#define HANDLE_ERROR(env, err)                                           \
    if (err != nullptr) {                                                \
        Napi::Error::New(env, string(err)).ThrowAsJavaScriptException(); \
        free(err);                                                       \
        return env.Undefined();                                          \
    }

// Helper function to convert JavaScript array to C string array
vector<char*> JSArrayToCStringArray(const Napi::Array& jsArray) {
    vector<char*> result;
    for (size_t i = 0; i < jsArray.Length(); i++) {
        Napi::Value element = jsArray[i];
        // Throws if not a string
        string str = element.As<Napi::String>().Utf8Value();
        char* cstr = new char[str.length() + 1];
        strcpy(cstr, str.c_str());
        result.push_back(cstr);
    }
    return result;
}

// Helper function to free C string array
void FreeCStringArray(vector<char*>& arr) {
    for (char* str : arr) {
        delete[] str;
    }
    arr.clear();
}

// Wrapper functions
Napi::Value ConfsecClientCreate(const Napi::CallbackInfo& info) {
    INIT_ERROR;

    Napi::Env env = info.Env();
    if (info.Length() < 5) {
        Napi::TypeError::New(env, "Expected 5 arguments").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    if (!info[0].IsString()) {
        Napi::TypeError::New(env, "API key must be a string").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    if (!info[1].IsNumber()) {
        Napi::TypeError::New(env, "Concurrent requests target must be a number").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    if (!info[2].IsNumber()) {
        Napi::TypeError::New(env, "Max candidate nodes must be a number").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    if (!info[3].IsArray()) {
        Napi::TypeError::New(env, "Default node tags must be an array").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    if (!info[4].IsString() && !info[4].IsNull()) {
        Napi::TypeError::New(env, "Environment must be a string or null").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    string apiKey = info[0].As<Napi::String>().Utf8Value();
    int concurrentRequestsTarget = info[1].As<Napi::Number>().Int32Value();
    int maxCandidateNodes = info[2].As<Napi::Number>().Int32Value();
    Napi::Array defaultNodeTagsArray = info[3].As<Napi::Array>();
    
    vector<char*> defaultNodeTags = JSArrayToCStringArray(defaultNodeTagsArray);
    
    char* env_param = nullptr;
    if (info[4].IsString()) {
        string envStr = info[4].As<Napi::String>().Utf8Value();
        env_param = new char[envStr.length() + 1];
        strcpy(env_param, envStr.c_str());
    }

    uintptr_t handle = Confsec_ClientCreate(
        const_cast<char*>(apiKey.c_str()),
        concurrentRequestsTarget,
        maxCandidateNodes,
        defaultNodeTags.data(),
        defaultNodeTags.size(),
        env_param,
        &err
    );

    // Clean up
    FreeCStringArray(defaultNodeTags);
    if (env_param) delete[] env_param;

    HANDLE_ERROR(env, err);

    if (handle == 0) {
        Napi::Error::New(env, "Unexpected error creating client").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    return Napi::Number::New(env, static_cast<double>(handle));
}

Napi::Value ConfsecClientDestroy(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    INIT_ERROR;

    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Expected handle as number").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    uintptr_t handle = static_cast<uintptr_t>(info[0].As<Napi::Number>().DoubleValue());
    
    Confsec_ClientDestroy(handle, &err);
    HANDLE_ERROR(env, err);

    return env.Undefined();
}

Napi::Value ConfsecClientGetDefaultCreditAmountPerRequest(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    INIT_ERROR;

    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Expected handle as number").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    uintptr_t handle = static_cast<uintptr_t>(info[0].As<Napi::Number>().DoubleValue());
    
    long defaultCreditAmount = Confsec_ClientGetDefaultCreditAmountPerRequest(handle, &err);
    HANDLE_ERROR(env, err);

    return Napi::Number::New(env, defaultCreditAmount);
}

Napi::Value ConfsecClientGetMaxCandidateNodes(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    INIT_ERROR;

    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Expected handle as number").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    uintptr_t handle = static_cast<uintptr_t>(info[0].As<Napi::Number>().DoubleValue());
    
    int maxCandidateNodes = Confsec_ClientGetMaxCandidateNodes(handle, &err);
    HANDLE_ERROR(env, err);

    return Napi::Number::New(env, maxCandidateNodes);
}

Napi::Value ConfsecClientGetDefaultNodeTags(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    INIT_ERROR;

    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Expected handle as number").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    uintptr_t handle = static_cast<uintptr_t>(info[0].As<Napi::Number>().DoubleValue());
    
    size_t defaultNodeTagsCount;
    char** defaultNodeTags = Confsec_ClientGetDefaultNodeTags(handle, &defaultNodeTagsCount, &err);
    HANDLE_ERROR(env, err);

    Napi::Array result = Napi::Array::New(env, defaultNodeTagsCount);
    for (size_t i = 0; i < defaultNodeTagsCount; i++) {
        result[i] = Napi::String::New(env, defaultNodeTags[i]);
    }

    return result;
}

Napi::Value ConfsecClientSetDefaultNodeTags(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    INIT_ERROR;

    if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsArray()) {
        Napi::TypeError::New(env, "Expected handle as number and tags as array").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    uintptr_t handle = static_cast<uintptr_t>(info[0].As<Napi::Number>().DoubleValue());
    Napi::Array defaultNodeTagsArray = info[1].As<Napi::Array>();
    
    vector<char*> defaultNodeTags = JSArrayToCStringArray(defaultNodeTagsArray);
    
    Confsec_ClientSetDefaultNodeTags(handle, defaultNodeTags.data(), defaultNodeTags.size(), &err);
    
    FreeCStringArray(defaultNodeTags);
    HANDLE_ERROR(env, err);

    return env.Undefined();
}

Napi::Value ConfsecClientGetWalletStatus(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    INIT_ERROR;

    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Expected handle as number").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    uintptr_t handle = static_cast<uintptr_t>(info[0].As<Napi::Number>().DoubleValue());
    
    char* walletStatus = Confsec_ClientGetWalletStatus(handle, &err);
    HANDLE_ERROR(env, err);

    Napi::String result = Napi::String::New(env, walletStatus);
    Confsec_Free(walletStatus);

    return result;
}

Napi::Value ConfsecClientDoRequest(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    INIT_ERROR;

    if (info.Length() < 2 || !info[0].IsNumber() || (!info[1].IsString() && !info[1].IsBuffer())) {
        Napi::TypeError::New(env, "Expected handle as number and request as string or buffer").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    uintptr_t handle = static_cast<uintptr_t>(info[0].As<Napi::Number>().DoubleValue());
    
    char* request;
    size_t requestLength;
    
    if (info[1].IsString()) {
        string requestStr = info[1].As<Napi::String>().Utf8Value();
        request = const_cast<char*>(requestStr.c_str());
        requestLength = requestStr.length();
    } else {
        Napi::Buffer<char> requestBuffer = info[1].As<Napi::Buffer<char>>();
        request = requestBuffer.Data();
        requestLength = requestBuffer.Length();
    }

    uintptr_t responseHandle = Confsec_ClientDoRequest(handle, request, requestLength, &err);
    HANDLE_ERROR(env, err);

    if (responseHandle == 0) {
        Napi::Error::New(env, "Unexpected request failure").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    return Napi::Number::New(env, static_cast<double>(responseHandle));
}

Napi::Value ConfsecResponseDestroy(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    INIT_ERROR;

    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Expected handle as number").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    uintptr_t handle = static_cast<uintptr_t>(info[0].As<Napi::Number>().DoubleValue());
    
    Confsec_ResponseDestroy(handle, &err);
    HANDLE_ERROR(env, err);

    return env.Undefined();
}

Napi::Value ConfsecResponseGetMetadata(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    INIT_ERROR;

    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Expected handle as number").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    uintptr_t handle = static_cast<uintptr_t>(info[0].As<Napi::Number>().DoubleValue());
    
    char* metadata = Confsec_ResponseGetMetadata(handle, &err);
    HANDLE_ERROR(env, err);

    if (metadata == nullptr) {
        Napi::Error::New(env, "Unexpected error getting request metadata").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    Napi::Buffer<char> result = Napi::Buffer<char>::Copy(env, metadata, strlen(metadata));
    Confsec_Free(metadata);

    return result;
}

Napi::Value ConfsecResponseIsStreaming(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    INIT_ERROR;

    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Expected handle as number").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    uintptr_t handle = static_cast<uintptr_t>(info[0].As<Napi::Number>().DoubleValue());
    
    bool isStreaming = Confsec_ResponseIsStreaming(handle, &err);
    HANDLE_ERROR(env, err);

    return Napi::Boolean::New(env, isStreaming);
}

Napi::Value ConfsecResponseGetBody(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    INIT_ERROR;

    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Expected handle as number").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    uintptr_t handle = static_cast<uintptr_t>(info[0].As<Napi::Number>().DoubleValue());
    
    char* body = Confsec_ResponseGetBody(handle, &err);
    HANDLE_ERROR(env, err);

    if (body == nullptr) {
        Napi::Error::New(env, "Unexpected error getting request body").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    Napi::Buffer<char> result = Napi::Buffer<char>::Copy(env, body, strlen(body));
    Confsec_Free(body);

    return result;
}

Napi::Value ConfsecResponseGetStream(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    INIT_ERROR;

    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Expected handle as number").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    uintptr_t handle = static_cast<uintptr_t>(info[0].As<Napi::Number>().DoubleValue());
    
    uintptr_t streamHandle = Confsec_ResponseGetStream(handle, &err);
    HANDLE_ERROR(env, err);

    if (streamHandle == 0) {
        Napi::Error::New(env, "Unexpected error getting response stream").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    return Napi::Number::New(env, static_cast<double>(streamHandle));
}

Napi::Value ConfsecResponseStreamGetNext(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    INIT_ERROR;

    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Expected handle as number").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    uintptr_t handle = static_cast<uintptr_t>(info[0].As<Napi::Number>().DoubleValue());
    
    char* chunk = Confsec_ResponseStreamGetNext(handle, &err);
    HANDLE_ERROR(env, err);

    if (chunk == nullptr) {
        return env.Null(); // No more chunks
    }

    Napi::Buffer<char> result = Napi::Buffer<char>::Copy(env, chunk, strlen(chunk));
    Confsec_Free(chunk);

    return result;
}

Napi::Value ConfsecResponseStreamDestroy(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    INIT_ERROR;

    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Expected handle as number").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    uintptr_t handle = static_cast<uintptr_t>(info[0].As<Napi::Number>().DoubleValue());
    
    Confsec_ResponseStreamDestroy(handle, &err);
    HANDLE_ERROR(env, err);

    return env.Undefined();
}

// Module initialization
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set(Napi::String::New(env, "confsecClientCreate"), 
                Napi::Function::New(env, ConfsecClientCreate));
    exports.Set(Napi::String::New(env, "confsecClientDestroy"), 
                Napi::Function::New(env, ConfsecClientDestroy));
    exports.Set(Napi::String::New(env, "confsecClientGetDefaultCreditAmountPerRequest"), 
                Napi::Function::New(env, ConfsecClientGetDefaultCreditAmountPerRequest));
    exports.Set(Napi::String::New(env, "confsecClientGetMaxCandidateNodes"), 
                Napi::Function::New(env, ConfsecClientGetMaxCandidateNodes));
    exports.Set(Napi::String::New(env, "confsecClientGetDefaultNodeTags"), 
                Napi::Function::New(env, ConfsecClientGetDefaultNodeTags));
    exports.Set(Napi::String::New(env, "confsecClientSetDefaultNodeTags"), 
                Napi::Function::New(env, ConfsecClientSetDefaultNodeTags));
    exports.Set(Napi::String::New(env, "confsecClientGetWalletStatus"), 
                Napi::Function::New(env, ConfsecClientGetWalletStatus));
    exports.Set(Napi::String::New(env, "confsecClientDoRequest"), 
                Napi::Function::New(env, ConfsecClientDoRequest));
    exports.Set(Napi::String::New(env, "confsecResponseDestroy"), 
                Napi::Function::New(env, ConfsecResponseDestroy));
    exports.Set(Napi::String::New(env, "confsecResponseGetMetadata"), 
                Napi::Function::New(env, ConfsecResponseGetMetadata));
    exports.Set(Napi::String::New(env, "confsecResponseIsStreaming"), 
                Napi::Function::New(env, ConfsecResponseIsStreaming));
    exports.Set(Napi::String::New(env, "confsecResponseGetBody"), 
                Napi::Function::New(env, ConfsecResponseGetBody));
    exports.Set(Napi::String::New(env, "confsecResponseGetStream"), 
                Napi::Function::New(env, ConfsecResponseGetStream));
    exports.Set(Napi::String::New(env, "confsecResponseStreamGetNext"), 
                Napi::Function::New(env, ConfsecResponseStreamGetNext));
    exports.Set(Napi::String::New(env, "confsecResponseStreamDestroy"), 
                Napi::Function::New(env, ConfsecResponseStreamDestroy));

    return exports;
}

NODE_API_MODULE(confsec, Init)
