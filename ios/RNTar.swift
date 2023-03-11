//
//  RNTar.swift
//  MetaMask
//
//  Created by Owen Craston on 2023-03-10.
//  Copyright © 2023 MetaMask. All rights reserved.
//

import Foundation

@objc(RNTar)
class RNTar: NSObject {
  
  
  @objc func unTar(_ path: String,
                   resolver: @escaping RCTPromiseResolveBlock,
                   rejecter: @escaping RCTPromiseRejectBlock) {
    print("unTar called with", path)
    resolver("Test")
  }
  
}
